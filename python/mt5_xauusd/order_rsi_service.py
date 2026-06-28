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
    ORDER_RSI_MODE,
    ORDER_RSI_POLL_MS,
    ORDER_RSI_RSI_PERIOD,
    ORDER_RSI_TICK_MS,
    ORDER_RSI_TIMEFRAMES,
    SYMBOL,
)
from .mt5_client import MT5Client, MAX_MT5_COPY_COUNT
from .postgres_client import PostgresClient
from .rsi_util import wilder_rsi_at_index

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


def _enrich_times(broker_wall: datetime) -> Dict[str, str]:
    """Broker wall time (naive) → NY + IST wall strings for UI."""
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
        count = min(self.period + 30, MAX_MT5_COPY_COUNT)
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

        bar_time = df["time"].iloc[-1].to_pydatetime()
        rsi = wilder_rsi_at_index(closes, self.period)
        close = closes[-1]

        return {
            "timeframe": tf_key,
            "barIndex": 0,
            "forming": True,
            "time": _enrich_times(bar_time),
            "close": round(close, 5),
            "rsi": round(rsi, 2) if rsi is not None else None,
            "rsiPeriod": self.period,
        }

    def build_snapshot(self, live_close: Optional[float]) -> Dict[str, Any]:
        now_broker = datetime.now(ZoneInfo(BROKER_SERVER_ZONE)).replace(tzinfo=None)
        time_block = _enrich_times(now_broker)

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

        return {
            "symbol": SYMBOL,
            "asOf": time_block,
            "price": round(float(price), 5) if price is not None else None,
            "priceSource": "forming_close",
            "pushMode": ORDER_RSI_MODE,
            "timeframes": timeframes,
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
