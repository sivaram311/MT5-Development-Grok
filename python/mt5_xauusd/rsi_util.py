"""Wilder RSI helpers (shared by live order-rsi and tests)."""

from typing import List, Optional


def wilder_rsi_at_index(closes: List[float], period: int = 14) -> Optional[float]:
    """
    Compute RSI(14) Wilder smoothing; return value at the last index (forming bar).
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

    rsi = None
    for i in range(period, n):
        if avg_loss == 0:
            rs = 100.0
        else:
            rs = avg_gain / avg_loss
        rsi = 100.0 - (100.0 / (1.0 + rs))
        avg_gain = ((avg_gain * (period - 1)) + gains[i]) / period
        avg_loss = ((avg_loss * (period - 1)) + losses[i]) / period

    return rsi
