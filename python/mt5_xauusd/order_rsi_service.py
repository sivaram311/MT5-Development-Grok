"""
Live Order RSI publisher — reads MT5 forming bars (index 0 / shift 0) and pushes snapshots to Postgres.

Configurable push mode:
  ORDER_RSI_MODE=tick  — push when tick last/bid changes (ORDER_RSI_TICK_MS sleep between checks)
  ORDER_RSI_MODE=poll  — push every ORDER_RSI_POLL_MS regardless of tick
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import MetaTrader5 as mt5
import pandas as pd

from .config import (
    BROKER_SERVER_ZONE,
    ORDER_RSI_HISTORY_BARS,
    ORDER_RSI_MODE,
    ORDER_RSI_POLL_MS,
    ORDER_RSI_RSI_PERIOD,
    ORDER_RSI_TICK_MS,
    ORDER_RSI_TIMEFRAMES,
    SYMBOL,
)
from .gann_odd_square_util import gann_odd_even_squares
from .mt5_client import MT5Client, MAX_MT5_COPY_COUNT
from .mt5_rsi_export import read_mt5_builtin_export
from .postgres_client import PostgresClient
from .pivot_util import classic_floor_pivots
from .rsi_util import wilder_rsi_forming_and_completed

logger = logging.getLogger(__name__)

MT5_TF_MAP = {
    "W1": mt5.TIMEFRAME_W1,
    "D1": mt5.TIMEFRAME_D1,
    "H4": mt5.TIMEFRAME_H4,
    "H1": mt5.TIMEFRAME_H1,
    "M15": mt5.TIMEFRAME_M15,
    "M5": mt5.TIMEFRAME_M5,
    "M1": mt5.TIMEFRAME_M1,
}


def _wall_iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _enrich_times_from_utc(utc_dt: datetime) -> Dict[str, str]:
    """MT5 copy_rates `time` is UTC — convert to broker / NY / IST wall strings."""
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=ZoneInfo("UTC"))
    ny = ZoneInfo("America/New_York")
    ist = ZoneInfo("Asia/Kolkata")
    broker_zone = ZoneInfo(BROKER_SERVER_ZONE)
    broker = utc_dt.astimezone(broker_zone).replace(tzinfo=None)
    return {
        "broker": _wall_iso(broker),
        "ny": _wall_iso(utc_dt.astimezone(ny).replace(tzinfo=None)),
        "ist": _wall_iso(utc_dt.astimezone(ist).replace(tzinfo=None)),
        "utc": _wall_iso(utc_dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)),
    }


def _enrich_times(broker_wall: datetime) -> Dict[str, str]:
    """Legacy: treat naive datetime as broker wall (avoid for bar times from MT5)."""
    zone = ZoneInfo(BROKER_SERVER_ZONE)
    ny = ZoneInfo("America/New_York")
    ist = ZoneInfo("Asia/Kolkata")
    zdt = broker_wall.replace(tzinfo=zone)
    return {
        "broker": _wall_iso(broker_wall),
        "ny": _wall_iso(zdt.astimezone(ny).replace(tzinfo=None)),
        "ist": _wall_iso(zdt.astimezone(ist).replace(tzinfo=None)),
    }


class OrderRsiPublisher:
    def __init__(self):
        self.mt5 = MT5Client()
        self.pg = PostgresClient()
        self.period = ORDER_RSI_RSI_PERIOD

    def _fetch_bars(self, tf_key: str, mt5_tf: int) -> Optional[pd.DataFrame]:
        count = min(max(self.period + 30, ORDER_RSI_HISTORY_BARS), MAX_MT5_COPY_COUNT)
        rates = mt5.copy_rates_from_pos(SYMBOL, mt5_tf, 0, count)
        if rates is None or len(rates) == 0:
            return None
        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        return df.sort_values("time").reset_index(drop=True)

    def _compute_tf_row(self, tf_key: str, mt5_tf: int, live_close: Optional[float]) -> Optional[Dict[str, Any]]:
        df = self._fetch_bars(tf_key, mt5_tf)
        if df is None or df.empty:
            return None

        closes = df["close"].astype(float).tolist()
        if live_close is not None:
            closes[-1] = float(live_close)

        bar_time_utc = df["time"].iloc[-1].to_pydatetime().replace(tzinfo=ZoneInfo("UTC"))
        rsi_forming, rsi_completed = wilder_rsi_forming_and_completed(closes, self.period)
        close = closes[-1]
        high0 = float(df["high"].iloc[-1])
        low0 = float(df["low"].iloc[-1])

        row: Dict[str, Any] = {
            "timeframe": tf_key,
            "barIndex": 0,
            "forming": True,
            "time": _enrich_times_from_utc(bar_time_utc),
            "close": round(close, 5),
            "rsi": round(rsi_forming, 2) if rsi_forming is not None else None,
            "rsiPeriod": self.period,
            "rsiSource": "python_wilder",
            "historyBars": len(closes),
        }

        sr0 = classic_floor_pivots(high0, low0, close)
        if sr0:
            row["sr"] = sr0

        if len(df) >= 2:
            completed_time_utc = df["time"].iloc[-2].to_pydatetime().replace(tzinfo=ZoneInfo("UTC"))
            completed_close = float(df["close"].iloc[-2])
            completed_high = float(df["high"].iloc[-2])
            completed_low = float(df["low"].iloc[-2])
            completed_block: Dict[str, Any] = {
                "barIndex": 1,
                "forming": False,
                "time": _enrich_times_from_utc(completed_time_utc),
                "close": round(completed_close, 5),
                "rsi": round(rsi_completed, 2) if rsi_completed is not None else None,
            }
            sr1 = classic_floor_pivots(completed_high, completed_low, completed_close)
            if sr1:
                completed_block["sr"] = sr1
            row["completed"] = completed_block

        gann_pivot = float(row["completed"]["close"]) if row.get("completed") else close
        gann = gann_odd_even_squares(gann_pivot)
        if gann:
            row["gann"] = gann

        mt5_block = self._mt5_export_block(tf_key)
        if mt5_block:
            s0 = mt5_block.get("shift0", {})
            s1 = mt5_block.get("shift1", {})
            row["mt5"] = {
                "available": True,
                "shift0": {"rsi": s0.get("rsi"), "close": s0.get("close")},
                "shift1": {"rsi": s1.get("rsi"), "close": s1.get("close")},
            }

        return row

    def _mt5_export_block(self, tf_key: str) -> Optional[Dict[str, Any]]:
        export = read_mt5_builtin_export()
        if not export:
            return None
        block = export.get("timeframes", {}).get(tf_key)
        return block if isinstance(block, dict) else None

    def build_snapshot(self, live_close: Optional[float]) -> Dict[str, Any]:
        now_utc = datetime.now(ZoneInfo("UTC"))
        time_block = _enrich_times_from_utc(now_utc)

        timeframes: Dict[str, Any] = {}
        for tf_key in ORDER_RSI_TIMEFRAMES:
            mt5_tf = MT5_TF_MAP.get(tf_key)
            if mt5_tf is None:
                continue
            row = self._compute_tf_row(tf_key, mt5_tf, live_close)
            if row:
                timeframes[tf_key] = row

        price = live_close
        if price is None and timeframes.get("M1"):
            price = timeframes["M1"]["close"]

        mt5_export = read_mt5_builtin_export()

        return {
            "symbol": SYMBOL,
            "asOf": time_block,
            "price": round(float(price), 5) if price is not None else None,
            "priceSource": "forming_close",
            "pushMode": ORDER_RSI_MODE,
            "timeframes": timeframes,
            "mt5ExportAvailable": mt5_export is not None,
            "live": self.mt5.initialized and mt5.terminal_info() is not None,
        }

    def _current_tick_close(self) -> Optional[float]:
        tick = mt5.symbol_info_tick(SYMBOL)
        if tick is None:
            return None
        if tick.last and tick.last > 0:
            return float(tick.last)
        if tick.bid and tick.bid > 0:
            return float(tick.bid)
        return None

    def run(self):
        from .data_downloader import configure_logging

        configure_logging(log_to_file=True)
        self.pg.ensure_live_order_rsi_table()

        if not self.mt5.ensure_connected(max_attempts=5):
            logger.error("Order RSI publisher: MT5 connection failed")
            return

        logger.info(
            "Order RSI publisher started mode=%s tick_ms=%s poll_ms=%s tfs=%s",
            ORDER_RSI_MODE,
            ORDER_RSI_TICK_MS,
            ORDER_RSI_POLL_MS,
            ORDER_RSI_TIMEFRAMES,
        )

        last_price: Optional[float] = None
        last_push = 0.0

        try:
            while True:
                if not self.mt5.ensure_connected(max_attempts=2):
                    time.sleep(2)
                    continue

                tick_close = self._current_tick_close()
                now = time.time()
                should_push = False

                if ORDER_RSI_MODE == "poll":
                    should_push = (now - last_push) * 1000 >= ORDER_RSI_POLL_MS
                else:
                    if tick_close is None:
                        time.sleep(ORDER_RSI_TICK_MS / 1000.0)
                        continue
                    if last_price is None or tick_close != last_price:
                        should_push = True
                    elif (now - last_push) * 1000 >= ORDER_RSI_POLL_MS:
                        should_push = True

                if should_push:
                    snapshot = self.build_snapshot(tick_close)
                    self.pg.upsert_live_order_rsi(snapshot)
                    last_push = now
                    last_price = tick_close
                    logger.debug(
                        "Order RSI pushed price=%s M1_rsi=%s",
                        snapshot.get("price"),
                        snapshot.get("timeframes", {}).get("M1", {}).get("rsi"),
                    )

                sleep_ms = ORDER_RSI_TICK_MS if ORDER_RSI_MODE == "tick" else max(50, ORDER_RSI_POLL_MS // 4)
                time.sleep(sleep_ms / 1000.0)
        finally:
            self.mt5.shutdown()
            logger.info("Order RSI publisher stopped")
