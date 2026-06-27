#!/usr/bin/env python
"""
Convenience runner for the XAUUSD MT5 Data Downloader.

Run from the `python` directory:
    python run_data_downloader.py

Defaults to continuous daemon using smart per-TF poll intervals (see config).
Pass --poll-seconds=45 to force a single uniform interval for all timeframes.

This avoids the need to remember `python -m mt5_xauusd.main`
"""
import sys
import os

def _configure_stdio():
    """Use UTF-8 on Windows so Unicode output works under cmd.exe / StackPilot."""
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

_configure_stdio()

# Ensure the mt5_xauusd package can be found when running the wrapper directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mt5_xauusd.main import main

if __name__ == "__main__":
    # Default to daemon mode (all TFs, smart per-TF poll intervals from config)
    # Use --poll-seconds=45 (or any) to force uniform interval for all TFs
    if len(sys.argv) == 1:
        sys.argv += ['--daemon']

    main()
