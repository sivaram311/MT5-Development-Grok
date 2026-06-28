"""
Configuration for MT5 XAUUSD Data Downloader
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ====================== MT5 Configuration ======================
# Path to your MT5 terminal64.exe
# Leave as None to auto-detect in common locations (recommended).
# Otherwise provide the full path, e.g.:
# MT5_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
MT5_PATH = None

# Symbol to download
SYMBOL = "XAUUSD"

# Timeframes to download (key used for table names: XAUUSD_{key})
TIMEFRAMES = ["D1", "H4", "H1", "M15", "M5", "M1"]

# Map from key to MT5 constant (used internally)
TIMEFRAME_MAP = {
    "D1": "TIMEFRAME_D1",
    "H4": "TIMEFRAME_H4",
    "H1": "TIMEFRAME_H1",
    "M15": "TIMEFRAME_M15",
    "M5": "TIMEFRAME_M5",
    "M1": "TIMEFRAME_M1",
}

# Number of bars to fetch per request (MT5 has limits)
BATCH_SIZE = 10000

# Default poll interval in seconds for continuous --daemon mode (used if not using per-TF)
# 45s is a good default to check all timeframes without excessive load
CONTINUOUS_POLL_SECONDS = 45

# Recommended poll intervals per timeframe (in seconds) for efficient live sync
# These are used in run_continuous_sync for per-TF scheduling
TIMEFRAME_POLL_INTERVALS = {
    "M1": 15,    # every 15 seconds
    "M5": 30,    # every 30 seconds
    "M15": 60,   # every minute
    "H1": 180,   # every 3 minutes
    "H4": 600,   # every 10 minutes
    "D1": 1800,  # every 30 minutes
}

# ====================== PostgreSQL Configuration ======================
# Using same database as Spring Boot application
# Recommended: Use the same credentials from backend/application.properties

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "database": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

# Schema used by Spring Boot
SCHEMA = "grok_dev"

# Table naming: XAUUSD_{Timeframe}
def get_table_name(timeframe_key: str) -> str:
    return f"XAUUSD_{timeframe_key}"

# ====================== General Settings ======================
# Enable debug logging (env: DEBUG=true|false)
DEBUG = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

# Whether to create tables if they don't exist
CREATE_TABLES_IF_NOT_EXIST = True
