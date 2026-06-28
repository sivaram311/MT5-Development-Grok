from mt5_xauusd.rsi_util import wilder_rsi_at_index


def test_wilder_rsi_last_index():
    # monotonic rise → high RSI at end
    closes = [float(i) for i in range(1, 30)]
    rsi = wilder_rsi_at_index(closes, period=14)
    assert rsi is not None
    assert rsi > 70


def test_wilder_rsi_insufficient_bars():
    assert wilder_rsi_at_index([1.0, 2.0, 3.0], period=14) is None
