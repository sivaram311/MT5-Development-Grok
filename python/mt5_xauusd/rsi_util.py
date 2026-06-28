"""Wilder RSI helpers (shared by live order-rsi and tests).

Matches MetaTrader 5 iRSI(14, PRICE_CLOSE):
- First average = SMA of the first `period` price changes (bars 1..period).
- First RSI at bar index `period`.
- Subsequent bars: Wilder smooth, then RSI (no double-count of bar `period`).
"""

from typing import List, Optional


def wilder_rsi_at_index(closes: List[float], period: int = 14) -> Optional[float]:
    """
    Compute Wilder RSI; return value at the last index.
    `closes` must be chronological (oldest → newest).
    """
    n = len(closes)
    if n <= period:
        return None

    gains = [0.0] * n
    losses = [0.0] * n
    for i in range(1, n):
        change = closes[i] - closes[i - 1]
        gains[i] = max(change, 0.0)
        losses[i] = max(-change, 0.0)

    avg_gain = sum(gains[1 : period + 1]) / period
    avg_loss = sum(losses[1 : period + 1]) / period

    if avg_loss == 0:
        rsi = 100.0
    else:
        rsi = 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))

    for i in range(period + 1, n):
        avg_gain = ((avg_gain * (period - 1)) + gains[i]) / period
        avg_loss = ((avg_loss * (period - 1)) + losses[i]) / period
        if avg_loss == 0:
            rsi = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi = 100.0 - (100.0 / (1.0 + rs))

    return rsi


def wilder_rsi_forming_and_completed(
    closes: List[float], period: int = 14
) -> tuple[Optional[float], Optional[float]]:
    """
    Return (forming_rsi, completed_rsi) for MT5 shift 0 and shift 1.
    `closes` must include the forming bar as the last element (oldest → newest).
    """
    forming = wilder_rsi_at_index(closes, period)
    if len(closes) <= period + 1:
        return forming, None
    completed = wilder_rsi_at_index(closes[:-1], period)
    return forming, completed
