r"""
Main entry point for XAUUSD MT5 Data Downloader

This script connects to your running MT5 terminal and downloads
historical OHLC data for XAUUSD into PostgreSQL (grok_dev schema).

Tables created/updated:
  - XAUUSD_D1
  - XAUUSD_H4
  - XAUUSD_H1
  - XAUUSD_M15
  - XAUUSD_M5
  - XAUUSD_M1

Usage:
    cd E:\Source\grok_dev\python
    python -m mt5_xauusd.main

    # Or for testing just one timeframe:
    # Edit the timeframes list below
"""

import sys
import os
import argparse

# Support both:
#   python -m mt5_xauusd.main   (recommended)
#   python mt5_xauusd/main.py   (direct)
if __package__ is None or __package__ == "":
    # Running as script, add parent to sys.path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from data_downloader import XAUUSDDownloader
else:
    # Running as module (-m), use relative import
    from .data_downloader import XAUUSDDownloader

def main():
    parser = argparse.ArgumentParser(description="Download XAUUSD historical data from MT5 to Postgres")
    parser.add_argument(
        "--timeframes", "-t",
        nargs="+",
        default=["D1", "H4", "H1", "M15", "M5", "M1"],
        choices=["D1", "H4", "H1", "M15", "M5", "M1"],
        help="Timeframes to download (default: all)"
    )
    parser.add_argument(
        "--no-incremental",
        action="store_true",
        help="Force full download instead of incremental"
    )
    args = parser.parse_args()

    print("=== XAUUSD MT5 → PostgreSQL Data Downloader ===")
    print(f"Target Schema : grok_dev")
    print(f"Tables        : {', '.join([f'XAUUSD_{tf}' for tf in args.timeframes])}")
    print()

    downloader = XAUUSDDownloader()

    downloader.download_all(
        timeframes=args.timeframes,
        incremental=not args.no_incremental
    )

if __name__ == "__main__":
    main()
