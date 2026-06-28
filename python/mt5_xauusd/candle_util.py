"""Pure helpers for completed-candle filtering (unit-testable without MT5)."""

import pandas as pd


def drop_forming_bar(df: pd.DataFrame) -> pd.DataFrame:
    """Remove the last row — MT5 position 0 is the currently forming candle."""
    if df is None or df.empty:
        return df
    if len(df) > 1:
        return df.iloc[:-1].reset_index(drop=True)
    return df


def filter_after_since(df: pd.DataFrame, since: pd.Timestamp) -> pd.DataFrame:
    """Keep only rows strictly after `since` (avoids duplicate PK on upsert)."""
    if df is None or df.empty or since is None:
        return df
    return df[df['time'] > since].reset_index(drop=True)
