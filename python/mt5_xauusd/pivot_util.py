"""Classic floor pivot points from a single bar's H, L, C."""

from __future__ import annotations

from typing import Dict, Optional


def classic_floor_pivots(high: float, low: float, close: float) -> Optional[Dict[str, float]]:
    """
    Standard floor pivots (S3–S1, pivot, R1–R3) from one bar's high, low, close.
    Returns None if inputs are invalid.
    """
    h = float(high)
    l = float(low)
    c = float(close)
    if h <= 0 or l <= 0 or c <= 0 or h < l:
        return None

    pivot = (h + l + c) / 3.0
    r1 = 2.0 * pivot - l
    s1 = 2.0 * pivot - h
    r2 = pivot + (h - l)
    s2 = pivot - (h - l)
    r3 = h + 2.0 * (pivot - l)
    s3 = l - 2.0 * (h - pivot)

    return {
        "s3": round(s3, 5),
        "s2": round(s2, 5),
        "s1": round(s1, 5),
        "pivot": round(pivot, 5),
        "r1": round(r1, 5),
        "r2": round(r2, 5),
        "r3": round(r3, 5),
    }
