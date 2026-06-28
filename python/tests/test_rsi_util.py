from mt5_xauusd.rsi_util import wilder_rsi_at_index, wilder_rsi_forming_and_completed


def test_wilder_rsi_last_index():
    # monotonic rise → high RSI at end
    closes = [float(i) for i in range(1, 30)]
    rsi = wilder_rsi_at_index(closes, period=14)
    assert rsi is not None
    assert rsi > 70


def test_wilder_rsi_insufficient_bars():
    assert wilder_rsi_at_index([1.0, 2.0, 3.0], period=14) is None


def test_wilder_rsi_forming_and_completed_differ_on_live_bar():
    import random

    random.seed(42)
    closes = [4000.0 + random.uniform(-15, 15) for _ in range(100)]
    forming, completed = wilder_rsi_forming_and_completed(closes, period=14)
    assert forming is not None
    assert completed is not None
    assert abs(forming - completed) > 0.01


def test_wilder_rsi_short_history_still_returns_completed():
    closes = [float(i) for i in range(1, 16)]  # 15 bars → no shift-1 RSI
    forming, completed = wilder_rsi_forming_and_completed(closes, period=14)
    assert forming is not None
    assert completed is None
