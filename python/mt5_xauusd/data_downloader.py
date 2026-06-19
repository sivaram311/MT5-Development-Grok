"""
Main Data Downloader
Coordinates MT5 data fetching and Postgres storage for XAUUSD across timeframes.
"""

import MetaTrader5 as mt5
import pandas as pd
import logging
import time
from logging.handlers import RotatingFileHandler
from typing import List
import os

from .config import TIMEFRAMES, DEBUG, CONTINUOUS_POLL_SECONDS, TIMEFRAME_POLL_INTERVALS
from .mt5_client import MT5Client
from .postgres_client import PostgresClient

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_logging(log_to_file: bool = True, log_level: int = logging.INFO):
    """Setup logging for the downloader. Console + optional rotating file."""
    logger.setLevel(log_level)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)

    if log_to_file:
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)
        fh = RotatingFileHandler(
            os.path.join(log_dir, "xauusd_sync.log"),
            maxBytes=5*1024*1024,  # 5 MB
            backupCount=3
        )
        fh.setFormatter(formatter)
        logger.addHandler(fh)
        logger.info("File logging enabled: logs/xauusd_sync.log")


class XAUUSDDownloader:
    def __init__(self):
        self.mt5_client = MT5Client()
        self.pg_client = PostgresClient()

    def _get_mt5_timeframe_constant(self, tf_key: str) -> int:
        """Convert our key to MT5 constant."""
        mapping = {
            "D1": mt5.TIMEFRAME_D1,
            "H4": mt5.TIMEFRAME_H4,
            "H1": mt5.TIMEFRAME_H1,
            "M15": mt5.TIMEFRAME_M15,
            "M5": mt5.TIMEFRAME_M5,
            "M1": mt5.TIMEFRAME_M1,
        }
        return mapping.get(tf_key)

    def download_timeframe(self, tf_key: str, incremental: bool = True):
        """Download data for one specific timeframe."""
        mt5_tf = self._get_mt5_timeframe_constant(tf_key)
        if mt5_tf is None:
            logger.error(f"Unknown timeframe key: {tf_key}")
            return

        logger.info(f"\n{'='*60}")
        logger.info(f"Processing XAUUSD {tf_key}")
        logger.info(f"{'='*60}")

        # Initialize MT5 if not already
        if not self.mt5_client.initialized:
            if not self.mt5_client.initialize():
                return

        df = None

        if incremental:
            last_ts = self.pg_client.get_last_timestamp(f"XAUUSD_{tf_key}")
            if last_ts:
                logger.info(f"Last stored timestamp: {last_ts}. Fetching only newer data...")
                df = self.mt5_client.fetch_rates_since(mt5_tf, last_ts)
            else:
                logger.info("No existing data found. Performing full historical download...")
                df = self.mt5_client.fetch_all_rates(mt5_tf)
        else:
            df = self.mt5_client.fetch_all_rates(mt5_tf)

        if df is None or df.empty:
            logger.warning(f"No (new) data fetched for {tf_key}")
            return

        # Ensure time column is timezone naive for Postgres
        df['time'] = pd.to_datetime(df['time']).dt.tz_localize(None)

        # Save to Postgres
        self.pg_client.save_data(df, tf_key)

        logger.info(f"Completed {tf_key}: {len(df)} rows processed")

    def download_all(self, timeframes: List[str] = None, incremental: bool = True):
        """Download data for all or selected timeframes."""
        if timeframes is None:
            timeframes = list(TIMEFRAMES)

        logger.info(f"Starting XAUUSD download for: {timeframes}")

        # Ensure schema exists
        self.pg_client.ensure_schema_exists()

        # Create all tables upfront so that get_last_timestamp doesn't fail on UndefinedTable
        for tf in timeframes:
            table_name = f"XAUUSD_{tf}"
            self.pg_client.create_table_if_not_exists(table_name)

        try:
            if not self.mt5_client.initialize():
                logger.error("Could not connect to MT5. Aborting.")
                return

            for tf in timeframes:
                try:
                    self.download_timeframe(tf, incremental=incremental)
                except Exception as e:
                    logger.exception(f"Error processing {tf}: {e}")

        finally:
            self.mt5_client.shutdown()
            logger.info("Download process finished.")

    def run_continuous_sync(self, timeframes: List[str] = None, poll_seconds: int = None):
        """
        Continuously sync **only completed candles** as they form.

        Uses per-timeframe poll intervals (from config) for efficiency.
        Falls back to a single interval if provided.

        Always drops the last (forming) bar from MT5.
        Only upserts bars newer than what is already in the DB.
        """
        if timeframes is None:
            timeframes = list(TIMEFRAMES)

        # Use per-TF intervals from config, or fallback
        if poll_seconds is not None:
            poll_intervals = {tf: poll_seconds for tf in timeframes}
        else:
            poll_intervals = {tf: TIMEFRAME_POLL_INTERVALS.get(tf, CONTINUOUS_POLL_SECONDS) 
                              for tf in timeframes}

        setup_logging(log_to_file=True)
        logger.info(f"Starting CONTINUOUS completed-candle sync for {timeframes}")
        for tf, interval in poll_intervals.items():
            logger.info(f"  - {tf}: every {interval}s")

        self.pg_client.ensure_schema_exists()
        self.pg_client.ensure_sync_status_table()
        for tf in timeframes:
            self.pg_client.create_table_if_not_exists(f"XAUUSD_{tf}")

        # Track last poll time per timeframe for smart scheduling
        last_poll = {tf: 0 for tf in timeframes}

        try:
            while True:
                now = time.time()

                # Ensure MT5 connection (with automatic reconnection)
                if not self.mt5_client.ensure_connected(max_attempts=3):
                    logger.warning("MT5 connection lost. Will retry in next cycle.")
                    time.sleep(10)
                    continue

                for tf_key in timeframes:
                    interval = poll_intervals[tf_key]
                    if now - last_poll[tf_key] < interval:
                        continue  # not time yet for this TF

                    try:
                        mt5_tf = self._get_mt5_timeframe_constant(tf_key)
                        last_ts = self.pg_client.get_last_timestamp(f"XAUUSD_{tf_key}")

                        df = self.mt5_client.fetch_recent_completed_rates(
                            mt5_tf, since=last_ts, count=200
                        )

                        if df is not None and not df.empty:
                            df['time'] = pd.to_datetime(df['time']).dt.tz_localize(None)
                            self.pg_client.save_data(df, tf_key)
                            latest_time = df['time'].max()
                            self.pg_client.update_sync_status(tf_key, latest_time)
                            logger.info(f"Synced {len(df)} new completed {tf_key} candles")

                        last_poll[tf_key] = now
                    except Exception as e:
                        logger.exception(f"Error syncing completed candles for {tf_key}: {e}")
                        last_poll[tf_key] = now  # avoid hammering on error

                time.sleep(5)  # small sleep to check schedule frequently
        finally:
            self.mt5_client.shutdown()
            logger.info("Continuous sync stopped.")


if __name__ == "__main__":
    downloader = XAUUSDDownloader()
    # You can limit timeframes here for testing: ["D1", "H4"]
    downloader.download_all()
