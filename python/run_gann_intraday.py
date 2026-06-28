#!/usr/bin/env python
"""Live Gann intraday publisher for XAUUSD."""
import os
import sys


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

from mt5_xauusd.gann_intraday_service import GannIntradayPublisher

if __name__ == "__main__":
    GannIntradayPublisher().run()
