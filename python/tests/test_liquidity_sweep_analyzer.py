"""Tests for NY liquidity sweep analyzer."""

from mt5_xauusd.gann_intraday_util import compute_session_pivots
from mt5_xauusd.liquidity_sweep_analyzer import (
    LiquiditySetup,
    LiquiditySweepConfig,
    _dedupe_setups,
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


def _d1_bar(time: str, ny: str, h: float, l: float, c: float):
    return {"time": time, "nyTime": ny, "high": h, "low": l, "close": c}


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
    assert scan_day_setups([], {}, [], cfg) == []


def test_dedupe_setups_keeps_best_result():
    base = dict(
        date="2026-06-20",
        ny_time="09:15",
        ist_time="18:45",
        sweep_level=2300.0,
        structure_level=2305.0,
        entry=2306.0,
        sl=2295.0,
        tp1=2320.0,
        tp2=2335.0,
        rsi_htf=30.0,
        rsi_ltf=28.0,
        notes="",
        structure_time="2026-06-20T13:00:00",
    )
    a = LiquiditySetup(setup_id="a", direction="Bullish", result="Open", rr_achieved=1.0, **base)
    b = LiquiditySetup(setup_id="b", direction="Bullish", result="Win", rr_achieved=0.5, **base)
    b.ny_time = "09:20"
    out = _dedupe_setups([a, b])
    assert len(out) == 1
    assert out[0].result == "Win"


def test_compute_session_pivots_uses_prior_d1_for_session_date():
    d1 = [
        _d1_bar("2026-06-18T00:00:00", "2026-06-17", 2350, 2320, 2340),
        _d1_bar("2026-06-19T00:00:00", "2026-06-18", 2360, 2330, 2350),
        _d1_bar("2026-06-20T00:00:00", "2026-06-19", 2370, 2340, 2360),
    ]
    session = compute_session_pivots(d1, [], session_date="2026-06-20")
    assert session is not None
    assert session["pdh"] == 2370
    assert session["pdl"] == 2340
