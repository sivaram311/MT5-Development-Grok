"""
Main Data Downloader
Coordinates MT5 data fetching and Postgres storage for XAUUSD across timeframes.
"""

import MetaTrader5 as mt5
import pandas as pd
import logging
import time
from logging.handlers import RotatingFileHandler
from typing import List, Optional
import os

from .config import TIMEFRAMES, DEBUG, CONTINUOUS_POLL_SECONDS, TIMEFRAME_POLL_INTERVALS
from .mt5_client import MT5Client
from .postgres_client import PostgresClient

logger = logging.getLogger(__name__)
_configured = False


def configure_logging(log_to_file: bool = False, log_level: Optional[int] = None):
    """Single logging bootstrap for one-shot and daemon modes."""
    global _configured
    if _configured:
        return

    level = log_level if log_level is not None else (logging.DEBUG if DEBUG else logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    root = logging.getLogger()
    root.setLevel(level)

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)

    if log_to_file:
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)
        fh = RotatingFileHandler(
            os.path.join(log_dir, "xauusd_sync.log"),
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
        )
        fh.setFormatter(formatter)
        root.addHandler(fh)
        logger.info("File logging enabled: logs/xauusd_sync.log")

    _configured = True


class XAUUSDDownloader:
    def __init__(self):
        self.mt5_client = MT5Client()
        self.pg_client = PostgresClient()

    def _get_mt5_timeframe_constant(self, tf_key: str) -> int:
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
        mt5_tf = self._get_mt5_timeframe_constant(tf_key)
        if mt5_tf is None:
            logger.error(f"Unknown timeframe key: {tf_key}")
            return

        logger.info("Processing XAUUSD %s", tf_key)

        if not self.mt5_client.initialized:
            if not self.mt5_client.initialize():
                return

        df = None

        if incremental:
            last_ts = self.pg_client.get_last_timestamp(f"XAUUSD_{tf_key}")
            if last_ts:
                logger.info("Last stored timestamp: %s. Fetching only newer data…", last_ts)
                df = self.mt5_client.fetch_rates_since(mt5_tf, last_ts)
            else:
                logger.info("No existing data found. Performing full historical download…")
                df = self.mt5_client.fetch_all_rates(mt5_tf)
        else:
            df = self.mt5_client.fetch_all_rates(mt5_tf)

        if df is None or df.empty:
            logger.warning("No (new) data fetched for %s", tf_key)
            self.pg_client.touch_sync_status(tf_key)
            return

        df['time'] = pd.to_datetime(df['time']).dt.tz_localize(None)
        self.pg_client.save_data(df, tf_key)
        latest_time = df['time'].max()
        self.pg_client.update_sync_status(tf_key, latest_time)
        logger.info("Completed %s: %s rows processed", tf_key, len(df))

    def download_all(self, timeframes: List[str] = None, incremental: bool = True):
        if timeframes is None:
            timeframes = list(TIMEFRAMES)

        configure_logging(log_to_file=False)
        logger.info("Starting XAUUSD download for: %s", timeframes)

        self.pg_client.ensure_schema_exists()
        self.pg_client.ensure_sync_status_table()

        for tf in timeframes:
            self.pg_client.create_table_if_not_exists(f"XAUUSD_{tf}")

        self.pg_client.backfill_sync_status(timeframes)

        try:
            if not self.mt5_client.initialize():
                logger.error("Could not connect to MT5. Aborting.")
                return

            for tf in timeframes:
                try:
                    self.download_timeframe(tf, incremental=incremental)
                except Exception as e:
                    logger.exception("Error processing %s: %s", tf, e)

        finally:
            self.mt5_client.shutdown()
            logger.info("Download process finished.")

    def run_continuous_sync(self, timeframes: List[str] = None, poll_seconds: int = None):
        if timeframes is None:
            timeframes = list(TIMEFRAMES)

        if poll_seconds is not None:
            poll_intervals = {tf: poll_seconds for tf in timeframes}
        else:
            poll_intervals = {
                tf: TIMEFRAME_POLL_INTERVALS.get(tf, CONTINUOUS_POLL_SECONDS)
                for tf in timeframes
            }

        configure_logging(log_to_file=True)
        logger.info("Starting CONTINUOUS completed-candle sync for %s", timeframes)
        for tf, interval in poll_intervals.items():
            logger.info("  - %s: every %ss", tf, interval)

        self.pg_client.ensure_schema_exists()
        self.pg_client.ensure_sync_status_table()
        for tf in timeframes:
            self.pg_client.create_table_if_not_exists(f"XAUUSD_{tf}")

        self.pg_client.backfill_sync_status(timeframes)

        last_poll = {tf: 0 for tf in timeframes}

        try:
            while True:
                now = time.time()

                if not self.mt5_client.ensure_connected(max_attempts=3):
                    logger.warning("MT5 connection lost. Will retry in next cycle.")
                    time.sleep(10)
                    continue

                for tf_key in timeframes:
                    interval = poll_intervals[tf_key]
                    if now - last_poll[tf_key] < interval:
                        continue

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
                            logger.info("Synced %s new completed %s candles (latest=%s)", len(df), tf_key, latest_time)
                        else:
                            self.pg_client.touch_sync_status(tf_key)
                            logger.debug("No new completed candles for %s (daemon alive)", tf_key)

                        last_poll[tf_key] = now
                    except Exception as e:
                        logger.exception("Error syncing completed candles for %s: %s", tf_key, e)
                        last_poll[tf_key] = now

                time.sleep(5)
        finally:
            self.mt5_client.shutdown()
            logger.info("Continuous sync stopped.")


if __name__ == "__main__":
    configure_logging()
    downloader = XAUUSDDownloader()
    downloader.download_all()
