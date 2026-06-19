#!/usr/bin/env python
"""
Convenience runner for the XAUUSD MT5 Data Downloader.

Run from the `python` directory:
    python run_data_downloader.py

This avoids the need to remember `python -m mt5_xauusd.main`
"""
import sys
import os

# Ensure the mt5_xauusd package can be found when running the wrapper directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mt5_xauusd.main import main

if __name__ == "__main__":
    main()
