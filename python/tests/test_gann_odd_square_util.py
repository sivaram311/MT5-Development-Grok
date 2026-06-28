import math

from mt5_xauusd.gann_odd_square_util import gann_odd_even_squares, gann_unavailable


def test_gann_odd_square_levels_from_pivot():
    # P=25 (√5) → odd above: (√25+2)²=49, (√25+4)²=81
    levels = gann_odd_even_squares(25, bands=2)
    assert levels is not None
    assert levels["sqrtPivot"] == 5.0
    assert levels["oddSquare"]["above"] == [49.0, 81.0]
    assert levels["oddSquare"]["below"] == [9.0, 1.0]
    assert levels["nextOddAbove"] == 49.0
    assert levels["nextOddBelow"] == 9.0


def test_gann_even_square_offset():
    levels = gann_odd_even_squares(25, bands=1)
    assert levels is not None
    sp = math.sqrt(25)
    assert levels["evenSquare"]["above"][0] == round((sp + 3) ** 2, 5)
    assert levels["evenSquare"]["below"][0] == round((sp - 3) ** 2, 5)


def test_gann_invalid_pivot():
    assert gann_odd_even_squares(0) is None
    assert gann_odd_even_squares(-1) is None


def test_gann_unavailable():
    block = gann_unavailable("bar0_open", "missing_open")
    assert block["available"] is False
    assert block["pivotSource"] == "bar0_open"
