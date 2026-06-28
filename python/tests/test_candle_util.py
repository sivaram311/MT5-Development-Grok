import pandas as pd
import pytest

from mt5_xauusd.candle_util import drop_forming_bar, filter_after_since


def _sample_df(n: int) -> pd.DataFrame:
    times = pd.date_range('2026-01-01', periods=n, freq='h')
    return pd.DataFrame({'time': times, 'close': range(n)})


def test_drop_forming_bar_removes_last_row():
    df = _sample_df(5)
    result = drop_forming_bar(df)
    assert len(result) == 4
    assert result['time'].iloc[-1] == df['time'].iloc[-2]


def test_drop_forming_bar_single_row_unchanged():
    df = _sample_df(1)
    result = drop_forming_bar(df)
    assert len(result) == 1


def test_filter_after_since_excludes_boundary():
    df = _sample_df(3)
    since = df['time'].iloc[0]
    result = filter_after_since(df, since)
    assert len(result) == 2
    assert result['time'].min() > since


def test_poll_intervals_used_when_poll_seconds_none():
    from mt5_xauusd.config import TIMEFRAME_POLL_INTERVALS, CONTINUOUS_POLL_SECONDS

    timeframes = ['M1', 'D1']
    poll_seconds = None
    if poll_seconds is not None:
        intervals = {tf: poll_seconds for tf in timeframes}
    else:
        intervals = {tf: TIMEFRAME_POLL_INTERVALS.get(tf, CONTINUOUS_POLL_SECONDS) for tf in timeframes}

    assert intervals['M1'] == 15
    assert intervals['D1'] == 1800
