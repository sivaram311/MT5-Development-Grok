"""
MT5 Client - Handles connection to MetaTrader 5 terminal
"""

import MetaTrader5 as mt5
import pandas as pd
import os
from datetime import datetime
from typing import Optional
import logging

from .config import MT5_PATH, SYMBOL, BATCH_SIZE, DEBUG

# Common MT5 installation paths to try if MT5_PATH is None
COMMON_MT5_PATHS = [
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    r"D:\MT5\terminal64.exe",
    r"E:\MT5\terminal64.exe",
    r"E:\Program Files\MetaTrader 5\terminal64.exe",
    r"E:\ProgramFiles\MT5\terminal64.exe",
]

logger = logging.getLogger(__name__)


class MT5Client:
    def __init__(self):
        self.initialized = False

    def initialize(self) -> bool:
        """Initialize connection to MT5 terminal."""
        path_to_try = MT5_PATH

        # If no path configured, try to auto-detect
        if not path_to_try:
            for candidate in COMMON_MT5_PATHS:
                if os.path.exists(candidate):
                    path_to_try = candidate
                    logger.info(f"Auto-detected MT5 at: {path_to_try}")
                    break

        if not path_to_try or not os.path.exists(path_to_try):
            logger.error(f"MT5 terminal not found. Tried: {path_to_try or 'no specific path'}")
            logger.error("Please set the correct MT5_PATH in config.py or ensure MT5 is installed in a common location.")
            logger.error("Common locations searched: " + ", ".join(COMMON_MT5_PATHS))
            return False

        if not mt5.initialize(path=path_to_try):
            err = mt5.last_error()
            logger.error(f"Failed to initialize MT5 at {path_to_try}: {err}")
            logger.error("Make sure the MT5 terminal is running and you are logged in.")
            logger.error("Also ensure 'Allow DLL imports' is enabled in MT5 Tools -> Options -> Expert Advisors.")
            return False

        # Select symbol
        if not mt5.symbol_select(SYMBOL, True):
            logger.error(f"Failed to select symbol {SYMBOL}")
            self.shutdown()
            return False

        self.initialized = True
        logger.info(f"MT5 initialized successfully at {path_to_try}. Connected to: {mt5.account_info().server if mt5.account_info() else 'Unknown'}")
        return True

    def shutdown(self):
        """Shutdown MT5 connection."""
        if self.initialized:
            mt5.shutdown()
            self.initialized = False
            logger.info("MT5 connection closed.")

    def get_rates_batch(self, timeframe: int, start_pos: int, count: int = BATCH_SIZE) -> Optional[pd.DataFrame]:
        """
        Fetch a batch of rates from MT5.
        
        Returns DataFrame with columns: time, open, high, low, close, tick_volume, spread, real_volume
        """
        if not self.initialized:
            logger.error("MT5 not initialized")
            return None

        rates = mt5.copy_rates_from_pos(SYMBOL, timeframe, start_pos, count)

        if rates is None or len(rates) == 0:
            return None

        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')

        # Rename columns to be more consistent
        df = df.rename(columns={
            'tick_volume': 'tick_volume',
            'spread': 'spread',
            'real_volume': 'real_volume'
        })

        # Select and order columns
        columns = ['time', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume']
        df = df[columns]

        return df

    def fetch_all_rates(self, timeframe: int, max_bars: int = None) -> pd.DataFrame:
        """
        Fetch ALL available historical data for a given timeframe.
        Uses batch fetching to avoid MT5 limits.
        """
        all_data = []
        pos = 0

        logger.info(f"Starting full download for timeframe {timeframe}...")

        while True:
            df = self.get_rates_batch(timeframe, pos, BATCH_SIZE)
            
            if df is None or len(df) == 0:
                break

            all_data.append(df)
            pos += len(df)

            logger.info(f"Fetched {len(df)} bars. Total so far: {pos}")

            if max_bars and pos >= max_bars:
                logger.info(f"Reached max bars limit: {max_bars}")
                break

            # Safety break for very large downloads
            if pos > 5_000_000:
                logger.warning("Safety limit reached (5M bars). Stopping.")
                break

        if not all_data:
            return pd.DataFrame()

        result = pd.concat(all_data, ignore_index=True)
        result = result.drop_duplicates(subset=['time']).sort_values('time').reset_index(drop=True)
        
        logger.info(f"Total unique bars fetched: {len(result)}")
        return result

    def fetch_rates_since(self, timeframe: int, since: pd.Timestamp) -> pd.DataFrame:
        """
        Fetch rates from a specific datetime onwards (for incremental updates).
        """
        if not self.initialized:
            logger.error("MT5 not initialized")
            return pd.DataFrame()

        # Convert to MT5 time (seconds since epoch)
        from_time = int(since.timestamp())

        rates = mt5.copy_rates_from(SYMBOL, timeframe, from_time, 100000)  # large count

        if rates is None or len(rates) == 0:
            return pd.DataFrame()

        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')

        columns = ['time', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume']
        df = df[columns]

        # Filter strictly after 'since' to avoid duplicates
        df = df[df['time'] > since].reset_index(drop=True)
        return df

    def get_last_bar_time(self, timeframe: int) -> Optional[datetime]:
        """Get the timestamp of the most recent bar available in MT5."""
        df = self.get_rates_batch(timeframe, 0, 1)
        if df is not None and len(df) > 0:
            return df['time'].iloc[0]
        return None
