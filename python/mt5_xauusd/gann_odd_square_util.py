"""Gann Square of Nine — odd / even square price levels from a pivot."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

# On the So9 wheel, consecutive odd-square cell values (1, 9, 25, 49…) are 2 apart on √axis.
ODD_SQRT_STEP = 2.0
# Even-square diagonal is offset by 1 on the √axis from the odd path.
EVEN_SQRT_OFFSET = 1.0


def _sqrt_level(sp: float, offset: float) -> Optional[float]:
    root = sp + offset
    if root <= 0:
        return None
    return round(root * root, 5)


def gann_odd_even_squares(
    pivot: float, pivot_source: str = "bar1_close", bands: int = 3
) -> Optional[Dict[str, Any]]:
    """
    Compute odd- and even-square bands from pivot price P:
      odd  → (√P ± 2n)²
      even → (√P ± (2n ± 1))²
    Returns None when pivot is invalid.
    """
    p = float(pivot)
    if p <= 0:
        return None

    sp = math.sqrt(p)
    odd_above: List[float] = []
    odd_below: List[float] = []
    even_above: List[float] = []
    even_below: List[float] = []

    for i in range(1, bands + 1):
        step = i * ODD_SQRT_STEP
        oa = _sqrt_level(sp, step)
        ob = _sqrt_level(sp, -step)
        ea = _sqrt_level(sp, step + EVEN_SQRT_OFFSET)
        eb = _sqrt_level(sp, -(step + EVEN_SQRT_OFFSET))
        if oa is not None:
            odd_above.append(oa)
        if ob is not None:
            odd_below.append(ob)
        if ea is not None:
            even_above.append(ea)
        if eb is not None:
            even_below.append(eb)

    return {
        "available": True,
        "pivot": round(p, 5),
        "sqrtPivot": round(sp, 5),
        "pivotSource": pivot_source,
        "oddSquare": {"above": odd_above, "below": odd_below},
        "evenSquare": {"above": even_above, "below": even_below},
        "nextOddAbove": odd_above[0] if odd_above else None,
        "nextOddBelow": odd_below[0] if odd_below else None,
        "nextEvenAbove": even_above[0] if even_above else None,
        "nextEvenBelow": even_below[0] if even_below else None,
    }


def gann_unavailable(pivot_source: str, reason: str = "missing_data") -> Dict[str, Any]:
    """Placeholder when pivot input is not available (e.g. Bar 0 open missing)."""
    return {
        "available": False,
        "pivotSource": pivot_source,
        "reason": reason,
    }
