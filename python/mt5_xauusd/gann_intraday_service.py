"""Live Gann intraday publisher — pushes study snapshots to Postgres."""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import MetaTrader5 as mt5
import pandas as pd

from .config import BROKER_SERVER_ZONE, SYMBOL
from .gann_intraday_util import compute_gann_intraday_study
from .mt5_client import MT5Client
from .postgres_client import PostgresClient
from .rsi_util import wilder_rsi_at_index

logger = logging.getLogger(__name__)

MT5_TF_MAP = {"D1": mt5.TIMEFRAME_D1, "M15": mt5.TIMEFRAME_M15, "M5": mt5.TIMEFRAME_M5}
DEFAULT_ENTRY_TF = "M5"
DEFAULT_SO9_PIVOT = "nyOpen"
DEFAULT_SCALE = 1.0
DEFAULT_ATR_THRESHOLD = 1.25
POLL_MS = int(__import__("os").environ.get("GANN_INTRADAY_POLL_MS", "1000"))
TICK_MS = int(__import__("os").environ.get("GANN_INTRADAY_TICK_MS", "500"))


def _wall_iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _enrich_times(utc_dt: datetime) -> Dict[str, str]:
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=ZoneInfo("UTC"))
    ny = ZoneInfo("America/New_York")
    ist = ZoneInfo("Asia/Kolkata")
    return {
        "time": _wall_iso(utc_dt.astimezone(ZoneInfo(BROKER_SERVER_ZONE)).replace(tzinfo=None)),
        "nyTime": _wall_iso(utc_dt.astimezone(ny).replace(tzinfo=None)),
        "istTime": _wall_iso(utc_dt.astimezone(ist).replace(tzinfo=None)),
    }


class GannIntradayPublisher:
    def __init__(self):
        self.mt5 = MT5Client()
        self.pg = PostgresClient()
        self.entry_tf = __import__("os").environ.get("GANN_INTRADAY_ENTRY_TF", DEFAULT_ENTRY_TF)
        self.so9_pivot = __import__("os").environ.get("GANN_INTRADAY_SO9_PIVOT", DEFAULT_SO9_PIVOT)
        self.scale = float(__import__("os").environ.get("GANN_INTRADAY_TIME_SCALE", str(DEFAULT_SCALE)))
        self.atr_threshold = float(__import__("os").environ.get("GANN_INTRADAY_ATR_THRESHOLD", str(DEFAULT_ATR_THRESHOLD)))

    def _fetch_candles(self, tf_key: str, limit: int = 120) -> List[Dict[str, Any]]:
        mt5_tf = MT5_TF_MAP.get(tf_key)
        if mt5_tf is None:
            return []
        rates = mt5.copy_rates_from_pos(SYMBOL, mt5_tf, 0, limit)
        if rates is None or len(rates) == 0:
            return []
        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        df = df.sort_values("time").reset_index(drop=True)
        closes = df["close"].astype(float).tolist()
        rows: List[Dict[str, Any]] = []
        for rev_i, i in enumerate(range(len(df) - 1, -1, -1)):
            row = df.iloc[i]
            utc = row["time"].to_pydatetime().replace(tzinfo=ZoneInfo("UTC"))
            times = _enrich_times(utc)
            slice_closes = closes[: i + 1]
            rsi = wilder_rsi_at_index(slice_closes, 14) if len(slice_closes) > 14 else None
            tick_vol = row["tick_volume"] if "tick_volume" in row else row.get("real_volume", 0)
            rows.append({
                **times,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "tickVolume": int(tick_vol or 0),
                "rsi": rsi,
            })
        return rows

    def build_snapshot(self, live_close: Optional[float] = None) -> Dict[str, Any]:
        entry = self._fetch_candles(self.entry_tf)
        m15 = self._fetch_candles("M15")
        d1 = self._fetch_candles("D1", 30)
        if live_close is not None and entry:
            entry[0]["close"] = float(live_close)

        study = compute_gann_intraday_study(
            self.entry_tf, entry, m15, d1,
            so9_pivot_key=self.so9_pivot,
            time_scale_factor=self.scale,
            extension_threshold_atr=self.atr_threshold,
        )
        if study is None:
            return {
                "live": False,
                "symbol": SYMBOL,
                "message": "Insufficient data for Gann intraday study",
                "entryTf": self.entry_tf,
            }
        study["updatedAt"] = datetime.utcnow().replace(tzinfo=ZoneInfo("UTC")).isoformat()
        study["streamConnected"] = True
        return study

    def run(self):
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        if not self.mt5.connect():
            raise RuntimeError("MT5 connect failed")
        self.pg.ensure_live_gann_intraday_table()
        logger.info("Gann intraday publisher started (entry=%s pivot=%s)", self.entry_tf, self.so9_pivot)
        last_price = None
        last_push = 0.0
        while True:
            tick = mt5.symbol_info_tick(SYMBOL)
            price = float(tick.last or tick.bid) if tick else None
            now = time.time()
            changed = price is not None and price != last_price
            due = (now - last_push) * 1000 >= POLL_MS
            if changed or due:
                snap = self.build_snapshot(price)
                self.pg.upsert_live_gann_intraday(snap)
                last_push = now
                last_price = price
                sev = snap.get("reversalAlert", {}).get("severity", "none")
                if sev in ("high", "medium"):
                    logger.info("Gann alert %s — %s", sev, snap.get("reversalAlert", {}).get("setup"))
            time.sleep(TICK_MS / 1000.0)
