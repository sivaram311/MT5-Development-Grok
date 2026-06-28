"""NY liquidity sweep publisher — historical backfill + live snapshot."""

from __future__ import annotations

import argparse
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

import pandas as pd

from .config import BROKER_SERVER_ZONE, SYMBOL
from .gann_intraday_service import _enrich_times
from .liquidity_sweep_analyzer import LiquiditySweepConfig, detect_live_setup, scan_day_setups
from .mt5_client import MT5Client
from .postgres_client import PostgresClient
from .rsi_util import wilder_rsi_at_index

logger = logging.getLogger(__name__)

POLL_MS = int(os.environ.get("NY_LIQUIDITY_POLL_MS", "2000"))


def _df_to_bars(df: pd.DataFrame, with_rsi: bool = True) -> List[Dict[str, Any]]:
    if df.empty:
        return []
    rows: List[Dict[str, Any]] = []
    closes = df["close"].astype(float).tolist()
    for idx in range(len(df)):
        row = df.iloc[idx]
        ts = row["time"]
        if hasattr(ts, "to_pydatetime"):
            utc = ts.to_pydatetime().replace(tzinfo=ZoneInfo("UTC"))
        else:
            utc = datetime.fromisoformat(str(ts)[:19]).replace(tzinfo=ZoneInfo(BROKER_SERVER_ZONE)).astimezone(ZoneInfo("UTC"))
        times = _enrich_times(utc)
        rsi = wilder_rsi_at_index(closes[: idx + 1], 14) if with_rsi and idx >= 14 else None
        rows.append({
            **times,
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "tickVolume": int(row.get("tick_volume") or 0),
            "rsi": rsi,
        })
    return rows


def _group_by_ny_date(m5: List[dict]) -> Dict[str, List[dict]]:
    groups: Dict[str, List[dict]] = {}
    for b in m5:
        p = (b.get("nyTime") or b.get("time") or "")[:10]
        groups.setdefault(p, []).append(b)
    return groups


class NyLiquiditySweepPublisher:
    def __init__(self):
        self.pg = PostgresClient()
        self.mt5 = MT5Client()
        self.cfg = LiquiditySweepConfig()

    def load_bars_from_db(self) -> tuple[List[dict], List[dict], List[dict], List[dict]]:
        m5 = _df_to_bars(self.pg.fetch_candles_chronological("M5", 15000))
        m15 = _df_to_bars(self.pg.fetch_candles_chronological("M15", 8000))
        h1 = _df_to_bars(self.pg.fetch_candles_chronological("H1", 4000))
        d1 = _df_to_bars(self.pg.fetch_candles_chronological("D1", 120))
        return m5, m15, h1, d1

    def backfill_historical(self, days: int = 30) -> int:
        self.pg.ensure_liquidity_setups_table()
        m5, m15, h1, d1 = self.load_bars_from_db()
        if not m5:
            logger.warning("No M5 data for backfill")
            return 0

        ny_dates = sorted(_group_by_ny_date(m5).keys())[-days:]
        count = 0
        for ny_date in ny_dates:
            day_m5 = [b for b in m5 if (b.get("nyTime") or b.get("time") or "").startswith(ny_date)]
            if len(day_m5) < 20:
                continue
            setups = scan_day_setups(day_m5, m15, h1, d1, self.cfg)
            for s in setups:
                self.pg.upsert_liquidity_setup(s.to_dict())
                count += 1
        logger.info("Backfilled %d liquidity setups across %d NY days", count, len(ny_dates))
        return count

    def build_live_snapshot(self) -> Dict[str, Any]:
        m5, m15, h1, d1 = self.load_bars_from_db()
        if not m5:
            return {"live": False, "symbol": SYMBOL, "message": "Insufficient M5 data"}
        live = detect_live_setup(m5[-500:], m15, h1, d1, self.cfg)
        if live:
            return live
        return {
            "live": False,
            "symbol": SYMBOL,
            "message": "No active NY liquidity sweep setup",
            "updatedAt": datetime.utcnow().replace(tzinfo=ZoneInfo("UTC")).isoformat(),
        }

    def run_live(self):
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        self.pg.ensure_live_ny_liquidity_sweep_table()
        self.pg.ensure_liquidity_setups_table()
        logger.info("NY liquidity sweep publisher started (poll=%sms)", POLL_MS)
        while True:
            try:
                snap = self.build_live_snapshot()
                snap["updatedAt"] = datetime.utcnow().replace(tzinfo=ZoneInfo("UTC")).isoformat()
                self.pg.upsert_live_ny_liquidity_sweep(snap)
                if snap.get("live"):
                    self.pg.upsert_liquidity_setup(snap)
            except Exception as exc:
                logger.exception("Live snapshot failed: %s", exc)
            time.sleep(POLL_MS / 1000.0)


def main():
    parser = argparse.ArgumentParser(description="NY Liquidity Sweep analyzer publisher")
    parser.add_argument("--backfill", action="store_true", help="Scan historical setups into DB")
    parser.add_argument("--days", type=int, default=30, help="NY days to backfill")
    parser.add_argument("--live", action="store_true", help="Run live publisher loop")
    args = parser.parse_args()

    pub = NyLiquiditySweepPublisher()
    if args.backfill:
        pub.backfill_historical(args.days)
        return
    if args.live:
        pub.run_live()
        return
    snap = pub.build_live_snapshot()
    print(snap)


if __name__ == "__main__":
    main()
