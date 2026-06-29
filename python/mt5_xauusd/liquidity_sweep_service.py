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
from .liquidity_tf_util import ENTRY_TFS, HTF_OPTIONS, LTF_OPTIONS, TF_PRESETS, normalize_tf_config
from .mt5_client import MT5Client
from .postgres_client import PostgresClient
from .rsi_util import wilder_rsi_at_index

logger = logging.getLogger(__name__)

POLL_MS = int(os.environ.get("NY_LIQUIDITY_POLL_MS", "2000"))
TF_LOAD_LIMITS = {
    "M1": 20000,
    "M5": 15000,
    "M15": 8000,
    "H1": 4000,
    "H4": 2000,
    "D1": 120,
}


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


def _group_by_ny_date(bars: List[dict]) -> Dict[str, List[dict]]:
    groups: Dict[str, List[dict]] = {}
    for b in bars:
        p = (b.get("nyTime") or b.get("time") or "")[:10]
        groups.setdefault(p, []).append(b)
    return groups


def _required_tfs(entry_tf: str, htf: str, ltf: str) -> List[str]:
    needed = {"M15", entry_tf, htf, ltf, "D1"}
    return sorted(needed, key=lambda t: TF_LOAD_LIMITS.get(t, 0))


class NyLiquiditySweepPublisher:
    def __init__(self, entry_tf: str = "M15", htf: str = "H1", ltf: str = "M15"):
        entry, h, l = normalize_tf_config(entry_tf, htf, ltf)
        self.pg = PostgresClient()
        self.mt5 = MT5Client()
        self.cfg = LiquiditySweepConfig(entry_tf=entry, htf=h, ltf=l)

    def load_tf_bars_from_db(self) -> tuple[List[dict], Dict[str, List[dict]], List[dict]]:
        tfs = _required_tfs(self.cfg.entry_tf, self.cfg.htf, self.cfg.ltf)
        tf_bars: Dict[str, List[dict]] = {}
        for tf in tfs:
            limit = TF_LOAD_LIMITS.get(tf, 4000)
            tf_bars[tf] = _df_to_bars(self.pg.fetch_candles_chronological(tf, limit))
        entry_bars = tf_bars.get(self.cfg.entry_tf, [])
        d1 = tf_bars.get("D1", [])
        return entry_bars, tf_bars, d1

    def backfill_historical(self, days: int = 30) -> int:
        self.pg.ensure_liquidity_setups_table()
        entry_bars, tf_bars, d1 = self.load_tf_bars_from_db()
        if not entry_bars:
            logger.warning("No %s data for backfill", self.cfg.entry_tf)
            return 0

        ny_dates = sorted(_group_by_ny_date(entry_bars).keys())[-days:]
        count = 0
        for ny_date in ny_dates:
            day_entry = [b for b in entry_bars if (b.get("nyTime") or b.get("time") or "").startswith(ny_date)]
            min_bars = 20 if self.cfg.entry_tf == "M15" else 60
            if len(day_entry) < min_bars:
                continue
            setups = scan_day_setups(day_entry, tf_bars, d1, self.cfg)
            for s in setups:
                self.pg.upsert_liquidity_setup(s.to_dict())
                count += 1
        logger.info(
            "Backfilled %d liquidity setups across %d NY days (%s entry, %s/%s RSI)",
            count, len(ny_dates), self.cfg.entry_tf, self.cfg.htf, self.cfg.ltf,
        )
        return count

    def build_live_snapshot(self) -> Dict[str, Any]:
        entry_bars, tf_bars, d1 = self.load_tf_bars_from_db()
        if not entry_bars:
            return {"live": False, "symbol": SYMBOL, "message": f"Insufficient {self.cfg.entry_tf} data"}
        tail = 800 if self.cfg.entry_tf == "M1" else 500
        live = detect_live_setup(entry_bars[-tail:], tf_bars, d1, self.cfg)
        if live:
            return live
        return {
            "live": False,
            "symbol": SYMBOL,
            "message": "No active NY liquidity sweep setup",
            "entryTf": self.cfg.entry_tf,
            "htf": self.cfg.htf,
            "ltf": self.cfg.ltf,
            "updatedAt": datetime.utcnow().replace(tzinfo=ZoneInfo("UTC")).isoformat(),
        }

    def run_live(self):
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        self.pg.ensure_live_ny_liquidity_sweep_table()
        self.pg.ensure_liquidity_setups_table()
        logger.info(
            "NY liquidity sweep publisher started (poll=%sms, entry=%s, htf=%s, ltf=%s)",
            POLL_MS, self.cfg.entry_tf, self.cfg.htf, self.cfg.ltf,
        )
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
    parser.add_argument("--entry-tf", default="M15", choices=ENTRY_TFS, help="Entry timeframe")
    parser.add_argument("--htf", default="H1", choices=HTF_OPTIONS, help="Higher TF for RSI")
    parser.add_argument("--ltf", default="M15", choices=LTF_OPTIONS, help="Lower TF for RSI")
    args = parser.parse_args()

    pub = NyLiquiditySweepPublisher(args.entry_tf, args.htf, args.ltf)
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
