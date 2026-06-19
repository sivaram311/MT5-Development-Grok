"""
MT5 XAUUSD Data Downloader Package

Downloads historical OHLC data from MetaTrader 5 into PostgreSQL (grok_dev schema).
Tables follow pattern: XAUUSD_D1, XAUUSD_H4, XAUUSD_H1, XAUUSD_M15, XAUUSD_M5, XAUUSD_M1
"""

from .data_downloader import XAUUSDDownloader
from .config import SYMBOL, TIMEFRAMES, SCHEMA
