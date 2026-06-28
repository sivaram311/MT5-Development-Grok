"""Tests for NY liquidity sweep analyzer."""

from mt5_xauusd.liquidity_sweep_analyzer import (
    LiquiditySweepConfig,
    find_swings,
    scan_day_setups,
)


def _bar(time: str, o: float, h: float, l: float, c: float, ny: str, ist: str = ""):
    return {
        "time": time,
        "nyTime": ny,
        "istTime": ist or ny,
        "open": o,
        "high": h,
        "low": l,
        "close": c,
        "tickVolume": 100,
    }


def test_find_swings_detects_local_low():
    bars = [
        _bar(f"2026-06-20T13:0{i}:00", 100, 101, 99, 100, f"2026-06-20T09:0{i}:00")
        for i in range(5)
    ]
    bars[2] = _bar("2026-06-20T13:02:00", 100, 101, 95, 96, "2026-06-20T09:02:00")
    lows, highs = find_swings(bars, lookback=1)
    assert any(s["price"] == 95 for s in lows)


def test_scan_day_setups_empty_without_data():
    cfg = LiquiditySweepConfig()
    assert scan_day_setups([], [], [], [], cfg) == []
