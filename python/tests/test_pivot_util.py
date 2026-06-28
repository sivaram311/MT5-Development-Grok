from mt5_xauusd.pivot_util import classic_floor_pivots


def test_classic_floor_pivots_known_values():
    # H=100, L=90, C=95 → P=95; S/R keys map to UI labels (s↔r swapped vs raw math vars)
    levels = classic_floor_pivots(100, 90, 95)
    assert levels is not None
    assert levels["pivot"] == 95.0
    assert levels["s1"] == 100.0
    assert levels["r1"] == 90.0
    assert levels["s2"] == 105.0
    assert levels["r2"] == 85.0
    assert levels["s3"] == 110.0
    assert levels["r3"] == 80.0


def test_classic_floor_pivots_invalid():
    assert classic_floor_pivots(90, 100, 95) is None
    assert classic_floor_pivots(0, 90, 95) is None
