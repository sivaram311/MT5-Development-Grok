"""Read MT5 built-in iRSI values exported by GrokDevOrderRsiExport.mq5."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# MT5 FILE_COMMON → Terminal/Common/Files/
_DEFAULT_COMMON_FILES = Path(os.path.expandvars(r"%APPDATA%\MetaQuotes\Terminal\Common\Files"))
EXPORT_FILENAME = "grok_dev_order_rsi_mt5.json"
MAX_AGE_SECONDS = int(os.getenv("MT5_RSI_EXPORT_MAX_AGE", "30"))
_READ_RETRIES = 2


def common_files_dir() -> Path:
    env = os.getenv("MT5_COMMON_FILES")
    if env:
        return Path(env)
    return _DEFAULT_COMMON_FILES


def read_mt5_builtin_export(max_age_seconds: int = MAX_AGE_SECONDS) -> Optional[Dict[str, Any]]:
    path = common_files_dir() / EXPORT_FILENAME
    if not path.is_file():
        return None

    last_error: Optional[Exception] = None
    for attempt in range(_READ_RETRIES):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            updated_raw = data.get("updatedAt")
            if updated_raw:
                # EA v2+ uses TimeGMT() — parse as UTC
                updated = datetime.strptime(updated_raw, "%Y.%m.%d %H:%M:%S").replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - updated).total_seconds()
                if age > max_age_seconds:
                    logger.debug("MT5 RSI export stale (%.0fs old, max %ss)", age, max_age_seconds)
                    return None
            return data
        except (OSError, json.JSONDecodeError, ValueError) as ex:
            last_error = ex
            if attempt + 1 < _READ_RETRIES:
                continue
    logger.debug("Failed to read MT5 RSI export: %s", last_error)
    return None


def export_path() -> Path:
    return common_files_dir() / EXPORT_FILENAME
