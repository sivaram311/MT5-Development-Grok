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

Usage examples:
    python -m mt5_xauusd.main
    python -m mt5_xauusd.main --timeframes D1 H4 --no-incremental
    python -m mt5_xauusd.main --daemon --poll-seconds 5
    python run_data_downloader.py --daemon
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
from .config import CONTINUOUS_POLL_SECONDS, TIMEFRAMES

def main():
    parser = argparse.ArgumentParser(
        description="Download/sync XAUUSD historical + completed candles from MT5 into Postgres (grok_dev schema)"
    )
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
    parser.add_argument(
        "--daemon", "-d",
        action="store_true",
        help="Run in continuous mode: keep syncing only newly completed candles forever"
    )
    parser.add_argument(
        "--poll-seconds", type=int, default=CONTINUOUS_POLL_SECONDS,
        help="Override poll interval (seconds) for all timeframes in --daemon mode. "
             "By default each timeframe uses its own efficient interval from config "
             "(M1:15s, M5:30s, M15:60s, H1:180s, H4:600s, D1:1800s)."
    )
    args = parser.parse_args()

    print("=== XAUUSD MT5 → PostgreSQL Data Downloader ===")
    print(f"Target Schema : grok_dev")
    print(f"Tables        : {', '.join([f'XAUUSD_{tf}' for tf in args.timeframes])}")
    print()

    downloader = XAUUSDDownloader()

    if args.daemon:
        downloader.run_continuous_sync(
            timeframes=args.timeframes,
            poll_seconds=args.poll_seconds
        )
    else:
        downloader.download_all(
            timeframes=args.timeframes,
            incremental=not args.no_incremental
        )

if __name__ == "__main__":
    main()
