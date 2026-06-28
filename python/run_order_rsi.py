#!/usr/bin/env python
"""
Live Order RSI publisher for XAUUSD.

Run from the `python` directory ( alongside MT5 terminal ):
    python run_order_rsi.py

Environment:
    ORDER_RSI_MODE=tick|poll     (default tick — push on every price change)
    ORDER_RSI_TICK_MS=250        tick check interval when mode=tick
    ORDER_RSI_POLL_MS=1000       minimum push interval / poll mode interval
    ORDER_RSI_RSI_PERIOD=14
    ORDER_RSI_HISTORY_BARS=5000   # Wilder warm-up depth (match MT5 chart history)
    BROKER_SERVER_ZONE=UTC
"""
import sys
import os


def _configure_stdio():
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


_configure_stdio()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mt5_xauusd.order_rsi_service import OrderRsiPublisher

if __name__ == "__main__":
    OrderRsiPublisher().run()
