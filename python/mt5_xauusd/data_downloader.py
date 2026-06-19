"""
Main Data Downloader
Coordinates MT5 data fetching and Postgres storage for XAUUSD across timeframes.
"""

import MetaTrader5 as mt5
import pandas as pd
import logging
from typing import List

from .config import TIMEFRAMES, DEBUG
from .mt5_client import MT5Client
from .postgres_client import PostgresClient

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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


if __name__ == "__main__":
    downloader = XAUUSDDownloader()
    # You can limit timeframes here for testing: ["D1", "H4"]
    downloader.download_all()
