"""Gann intraday study — session pivots, 1×1 angle, So9, time square, killzones."""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .gann_odd_square_util import gann_odd_even_squares

NY_SESSION_START = 8 * 60
NY_SESSION_END = 17 * 60
LONDON_SESSION_START = 3 * 60
LONDON_SESSION_END = 5 * 60


def _parse_ny_parts(ny_time: str | None) -> Optional[tuple[str, int, int]]:
    if not ny_time:
        return None
    m = re.match(r"^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})", str(ny_time))
    if not m:
        return None
    return m.group(1), int(m.group(2)), int(m.group(3))


def _parse_ny_minutes(ny_time: str | None) -> Optional[int]:
    p = _parse_ny_parts(ny_time)
    if not p:
        return None
    return p[1] * 60 + p[2]


def _round2(n: float) -> float:
    return round(n, 2)


def _round5(n: float) -> float:
    return round(n, 5)


def _bar_date_key(bar: dict) -> str:
    return str(bar.get("nyTime") or bar.get("time") or "")[:10]


def _prior_d1_for_session(d1_asc: List[dict], session_date: str) -> Optional[dict]:
    """Return the D1 bar immediately before session_date (for PDH/PDL)."""
    if not d1_asc:
        return None
    candidate: Optional[dict] = None
    for bar in d1_asc:
        if _bar_date_key(bar) < session_date:
            candidate = bar
    if candidate is not None:
        return candidate
    return d1_asc[-2] if len(d1_asc) >= 2 else d1_asc[0]


def compute_session_pivots(
    d1: List[dict],
    m15: List[dict],
    session_date: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not d1:
        return None
    d1_asc = sorted(d1, key=lambda b: str(b.get("time") or ""))
    if session_date:
        prev = _prior_d1_for_session(d1_asc, session_date)
    else:
        prev = d1_asc[-2] if len(d1_asc) >= 2 else d1_asc[0]
    if not prev:
        return None
    pdh = prev.get("high") or prev.get("close")
    pdl = prev.get("low") or prev.get("close")
    prev_close = prev.get("close") or 0
    if pdh is None or pdl is None or prev_close <= 0:
        return None

    ny_open = ny_high = ny_low = london_open = london_high = london_low = None
    ny_start = london_start = None

    if m15:
        if not session_date:
            latest = _parse_ny_parts(m15[0].get("nyTime") or m15[0].get("time"))
            session_date = latest[0] if latest else None
        if session_date:
            ny_bars, london_bars = [], []
            for c in m15:
                p = _parse_ny_parts(c.get("nyTime") or c.get("time"))
                if not p or p[0] != session_date:
                    continue
                mins = p[1] * 60 + p[2]
                if NY_SESSION_START <= mins <= NY_SESSION_END:
                    ny_bars.append(c)
                if LONDON_SESSION_START <= mins < LONDON_SESSION_END:
                    london_bars.append(c)

            if ny_bars:
                ordered = list(reversed(ny_bars))
                first = ordered[0]
                ny_open = first.get("open") or first.get("close")
                ny_start = first.get("nyTime") or first.get("time")
                ny_high = max(b.get("high") or b.get("close") or 0 for b in ny_bars)
                ny_low = min(b.get("low") or b.get("close") or float("inf") for b in ny_bars)
                if not math.isfinite(ny_low):
                    ny_low = None

            if london_bars:
                ordered = list(reversed(london_bars))
                first = ordered[0]
                london_open = first.get("open") or first.get("close")
                london_start = first.get("nyTime") or first.get("time")
                london_high = max(b.get("high") or b.get("close") or 0 for b in london_bars)
                london_low = min(b.get("low") or b.get("close") or float("inf") for b in london_bars)
                if not math.isfinite(london_low):
                    london_low = None

    return {
        "pdh": float(pdh),
        "pdl": float(pdl),
        "prevClose": float(prev_close),
        "prevDayTime": prev.get("time"),
        "nySessionOpen": ny_open,
        "nySessionHigh": ny_high,
        "nySessionLow": ny_low,
        "nySessionStart": ny_start,
        "londonSessionOpen": london_open,
        "londonSessionHigh": london_high,
        "londonSessionLow": london_low,
        "londonSessionStart": london_start,
    }


def session_pivot_price(session: dict, key: str) -> Optional[float]:
    mapping = {
        "pdh": session.get("pdh"),
        "pdl": session.get("pdl"),
        "prevClose": session.get("prevClose"),
        "nyOpen": session.get("nySessionOpen"),
        "nyHigh": session.get("nySessionHigh"),
        "nyLow": session.get("nySessionLow"),
        "londonOpen": session.get("londonSessionOpen"),
        "londonHigh": session.get("londonSessionHigh"),
        "londonLow": session.get("londonSessionLow"),
    }
    val = mapping.get(key)
    return float(val) if val is not None else None


def _compute_atr(candles: List[dict], period: int = 14) -> float:
    if len(candles) < period + 1:
        return 0.0
    chrono = list(reversed(candles))
    total = 0.0
    for i in range(len(chrono) - period, len(chrono)):
        cur, prev = chrono[i], chrono[i - 1]
        h = cur.get("high") or cur.get("close") or 0
        l = cur.get("low") or cur.get("close") or 0
        pc = prev.get("close") or prev.get("open") or 0
        tr = max(h - l, abs(h - pc), abs(l - pc))
        total += tr
    return total / period


def compute_gann_one_by_one(
    candles: List[dict],
    pivot_price: float,
    pivot_label: str,
    origin_bar_index: int,
    atr_period: int = 14,
    extension_threshold_atr: float = 1.25,
) -> Optional[Dict[str, Any]]:
    if not candles or pivot_price <= 0:
        return None
    current = candles[0]
    current_price = current.get("close") or current.get("open")
    if current_price is None:
        return None

    atr = _compute_atr(candles, atr_period)
    slope = atr if atr > 0 else pivot_price * 0.0003
    bars = max(0, origin_bar_index)
    equilibrium = pivot_price + bars * slope
    deviation = float(current_price) - equilibrium
    deviation_atr = deviation / atr if atr > 0 else 0.0

    bias = "balanced"
    if deviation_atr >= extension_threshold_atr:
        bias = "overextended_up"
    elif deviation_atr <= -extension_threshold_atr:
        bias = "overextended_down"

    fan_lines = []
    for n in range(0, 13):
        fan_lines.append({
            "barsAhead": n,
            "oneByOne": _round2(pivot_price + (bars + n) * slope),
            "twoByOne": _round2(pivot_price + (bars + n) * slope * 2),
            "oneByTwo": _round2(pivot_price + (bars + n) * slope * 0.5),
        })

    angle_alert = abs(deviation_atr) >= extension_threshold_atr

    return {
        "pivotPrice": pivot_price,
        "pivotLabel": pivot_label,
        "currentPrice": float(current_price),
        "equilibriumPrice": _round2(equilibrium),
        "deviation": _round2(deviation),
        "deviationAtr": _round2(deviation_atr),
        "atr": _round2(atr),
        "barsFromOrigin": bars,
        "oneByOneSlope": _round2(slope),
        "bias": bias,
        "overextended": bias != "balanced",
        "angleAlert": angle_alert,
        "extensionThresholdAtr": extension_threshold_atr,
        "fanLines": fan_lines,
    }


def compute_so9_fine_levels(pivot: float) -> List[Dict[str, Any]]:
    if pivot <= 0:
        return []
    sp = math.sqrt(pivot)
    levels = []
    for unit in (0.25, 0.5, 1.0):
        hint = "180°" if unit >= 1 else ("90°" if unit >= 0.5 else "45°")
        for n in range(1, 4):
            for sign, direction in ((1, "above"), (-1, "below")):
                root = sp + sign * n * unit
                if root <= 0:
                    continue
                levels.append({
                    "label": f"{'+' if sign > 0 else '−'}{n}×{unit}",
                    "price": _round2(root * root),
                    "stepUnit": unit,
                    "stepCount": n,
                    "direction": direction,
                    "angleHint": hint,
                })
    levels.sort(key=lambda x: x["price"], reverse=True)
    return levels


def compute_time_square(
    session_start_ny: str | None,
    session_open_price: float | None,
    current_price: float | None,
    scale_factor: float = 1.0,
    now_ms: int | None = None,
) -> Optional[Dict[str, Any]]:
    if session_open_price is None or current_price is None or session_open_price <= 0:
        return None

    if now_ms is None:
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    start_ms = None
    if session_start_ny:
        p = _parse_ny_parts(session_start_ny)
        if p:
            start_ms = int(datetime.strptime(f"{p[0]}T{p[1]:02d}:{p[2]:02d}", "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp() * 1000)

    minutes_elapsed = max(0, (now_ms - start_ms) // 60000) if start_ms else 0
    price_move = float(current_price) - float(session_open_price)
    abs_move = abs(price_move)
    ratio = abs_move / minutes_elapsed if minutes_elapsed > 0 else 0.0

    milestones = []
    for minutes in (45, 90, 180):
        scaled = minutes * scale_factor
        target = float(session_open_price) + (scaled if price_move >= 0 else -scaled)
        near_time = abs(minutes_elapsed - minutes) <= 5
        near_price = abs(float(current_price) - target) <= max(2, abs_move * 0.05)
        near_equality = abs(abs_move - scaled) <= max(1.5, scaled * 0.08) and near_time
        milestones.append({
            "minutes": minutes,
            "label": f"{minutes} min",
            "scaledMove": _round2(scaled),
            "priceTarget": _round2(target),
            "nearSquare": near_time or near_price or near_equality,
        })

    any_near = any(m["nearSquare"] for m in milestones) or any(
        abs(minutes_elapsed - m) <= 3 and abs(abs_move - m * scale_factor) <= 3 for m in (45, 90, 180)
    )

    return {
        "sessionStart": session_start_ny,
        "minutesElapsed": minutes_elapsed,
        "priceMove": _round2(price_move),
        "absPriceMove": _round2(abs_move),
        "ratioPricePerMin": _round2(ratio),
        "scaleFactor": scale_factor,
        "milestones": milestones,
        "anyNearSquare": any_near,
    }


def evaluate_killzones(latest_ny_time: str | None, latest_ist_time: str | None = None) -> List[Dict[str, Any]]:
    mins = _parse_ny_minutes(latest_ny_time)
    ist_m = re.search(r"[T ](\d{2}):(\d{2})", latest_ist_time or "") if latest_ist_time else None
    ist_mins = int(ist_m.group(1)) * 60 + int(ist_m.group(2)) if ist_m else None

    zones = [
        {"id": "london_open", "label": "London Open", "window": "03:00–05:00 NY", "istWindow": "13:30–15:30 IST"},
        {"id": "ny_open", "label": "NY Open", "window": "08:00–10:00 NY", "istWindow": "17:30–19:30 IST"},
        {"id": "ny_overlap", "label": "NY Overlap", "window": "08:00–11:00 NY", "istWindow": "17:30–20:30 IST"},
        {"id": "ny_close", "label": "NY Afternoon", "window": "14:00–17:00 NY", "istWindow": "23:30–02:30 IST"},
    ]
    for z in zones:
        z["active"] = False
    if mins is None:
        return zones

    zones[0]["active"] = LONDON_SESSION_START <= mins < LONDON_SESSION_END
    zones[1]["active"] = 8 * 60 <= mins < 10 * 60
    zones[2]["active"] = 8 * 60 <= mins < 11 * 60
    zones[3]["active"] = 14 * 60 <= mins <= 17 * 60

    if ist_mins is not None:
        for z in zones:
            z["istActive"] = _ist_window_active(z["istWindow"], ist_mins)
    return zones


def _ist_window_active(window: str, ist_mins: int) -> bool:
    m = re.match(r"(\d{2}):(\d{2})–(\d{2}):(\d{2})", window)
    if not m:
        return False
    start = int(m.group(1)) * 60 + int(m.group(2))
    end = int(m.group(3)) * 60 + int(m.group(4))
    if end < start:
        return ist_mins >= start or ist_mins <= end
    return start <= ist_mins <= end


def detect_volume_spike(candles: List[dict], lookback: int = 20, multiplier: float = 1.5) -> bool:
    if len(candles) < lookback + 1:
        return False
    vols = [c.get("tickVolume") or c.get("tick_volume") or 0 for c in candles[1 : lookback + 1]]
    avg = sum(vols) / len(vols) if vols else 0
    cur = candles[0].get("tickVolume") or candles[0].get("tick_volume") or 0
    return avg > 0 and cur >= avg * multiplier


def detect_rsi_divergence(candles: List[dict], lookback: int = 5) -> Optional[str]:
    if len(candles) < lookback:
        return None
    sample = candles[:lookback]
    highs = [c.get("high") or c.get("close") or 0 for c in sample]
    rsis = [c.get("rsi") for c in sample if c.get("rsi") is not None]
    if len(rsis) < lookback:
        return None
    rsi_vals = [c.get("rsi") for c in sample]
    if highs[0] > max(highs[1:]) and rsi_vals[0] < max(r for r in rsi_vals[1:] if r is not None):
        return "bearish"
    lows = [c.get("low") or c.get("close") or 0 for c in sample]
    if lows[0] < min(lows[1:]) and rsi_vals[0] > min(r for r in rsi_vals[1:] if r is not None):
        return "bullish"
    return None


def build_reversal_alert(
    angle: dict | None,
    time_square: dict | None,
    killzones: List[dict],
    near_so9: bool,
    candles: List[dict],
    volume_spike: bool,
    rsi_divergence: str | None,
) -> Dict[str, Any]:
    reasons: List[str] = []
    score = 0

    if angle and angle.get("angleAlert"):
        bias = angle.get("bias", "balanced")
        direction = "above" if bias == "overextended_up" else "below"
        reasons.append(f"1×1 alert — stretched {direction} ({angle.get('deviationAtr')}× ATR)")
        score += 2
    elif angle and angle.get("overextended"):
        reasons.append(f"1×1 {angle.get('bias')} ({angle.get('deviationAtr')}× ATR)")
        score += 2

    if near_so9:
        reasons.append("At Square of Nine level")
        score += 1
    if time_square and time_square.get("anyNearSquare"):
        reasons.append("Time squaring milestone")
        score += 1
    active_kz = [z["label"] for z in killzones if z.get("active")]
    if active_kz:
        reasons.append(f"Killzone: {', '.join(active_kz)}")
        score += 1
    if _detect_reversal_candle(candles):
        reasons.append("Reversal candle pattern")
        score += 1
    if volume_spike:
        reasons.append("Volume spike vs 20-bar avg")
        score += 1
    if rsi_divergence:
        reasons.append(f"RSI {rsi_divergence} divergence")
        score += 1

    severity = "none"
    if score >= 5:
        severity = "high"
    elif score >= 3:
        severity = "medium"
    elif score >= 1:
        severity = "low"

    setup = {
        "high": "A+ mean-reversion confluence — confirm entry & use 1×1 as first target",
        "medium": "Watch for rejection — partial confluence",
        "low": "Early warning — wait for more alignment",
        "none": "No active reversal confluence",
    }[severity]

    return {"severity": severity, "active": severity != "none", "reasons": reasons, "setup": setup}


def _detect_reversal_candle(candles: List[dict]) -> bool:
    if len(candles) < 2:
        return False
    cur, prev = candles[0], candles[1]
    o0, c0 = cur.get("open") or cur.get("close") or 0, cur.get("close") or 0
    o1, c1 = prev.get("open") or prev.get("close") or 0, prev.get("close") or 0
    body0 = abs(c0 - o0)
    rng = (cur.get("high") or c0) - (cur.get("low") or c0)
    pin = rng > 0 and body0 / rng < 0.35
    bull = c0 > o0 and c1 < o1 and c0 >= o1 and o0 <= c1
    bear = c0 < o0 and c1 > o1 and c0 <= o1 and o0 >= c1
    return pin or bull or bear


def find_origin_bar_index(candles: List[dict], session_start: str | None) -> int:
    if not session_start or not candles:
        return min(len(candles) - 1, 12)
    for i, c in enumerate(candles):
        t = c.get("time") or c.get("nyTime")
        if t == session_start:
            return i
    return min(len(candles) - 1, 12)


def is_near_any_level(price: float, levels: List[float], tolerance_pct: float = 0.08) -> bool:
    if not levels or price <= 0:
        return False
    tol = max(price * (tolerance_pct / 100), 0.5)
    return any(abs(l - price) <= tol for l in levels)


def compute_gann_intraday_study(
    entry_tf: str,
    entry_candles: List[dict],
    m15_candles: List[dict],
    d1_candles: List[dict],
    so9_pivot_key: str = "nyOpen",
    time_scale_factor: float = 1.0,
    extension_threshold_atr: float = 1.25,
) -> Optional[Dict[str, Any]]:
    session = compute_session_pivots(d1_candles, m15_candles)
    if not session or not entry_candles:
        return None

    pivot_price = session_pivot_price(session, so9_pivot_key) or session.get("nySessionOpen") or session.get("prevClose")
    if pivot_price is None or pivot_price <= 0:
        return None

    current_price = entry_candles[0].get("close") or entry_candles[0].get("open") or pivot_price
    odd_even = gann_odd_even_squares(float(pivot_price), pivot_source=so9_pivot_key)
    if not odd_even:
        return None

    fine_levels = compute_so9_fine_levels(float(pivot_price))
    fine_above = [l for l in fine_levels if l["price"] > pivot_price]
    fine_below = [l for l in fine_levels if l["price"] < pivot_price]

    origin = find_origin_bar_index(m15_candles, session.get("nySessionStart"))
    labels = {
        "pdh": "PDH", "pdl": "PDL", "prevClose": "Prev close", "nyOpen": "NY open",
        "nyHigh": "NY high", "nyLow": "NY low", "londonOpen": "London open",
        "londonHigh": "London high", "londonLow": "London low",
    }
    angle = compute_gann_one_by_one(
        entry_candles, float(pivot_price), labels.get(so9_pivot_key, so9_pivot_key),
        origin, extension_threshold_atr=extension_threshold_atr,
    )
    if not angle:
        return None

    time_square = compute_time_square(
        session.get("nySessionStart"), session.get("nySessionOpen"), current_price, time_scale_factor,
    )

    latest = entry_candles[0]
    killzones = evaluate_killzones(latest.get("nyTime") or latest.get("time"), latest.get("istTime"))
    all_levels = (
        odd_even["oddSquare"]["above"] + odd_even["oddSquare"]["below"]
        + odd_even["evenSquare"]["above"] + odd_even["evenSquare"]["below"]
        + [l["price"] for l in fine_levels]
    )
    near_so9 = is_near_any_level(float(current_price), all_levels)
    vol_spike = detect_volume_spike(entry_candles)
    rsi_div = detect_rsi_divergence(entry_candles)
    reversal = build_reversal_alert(angle, time_square, killzones, near_so9, entry_candles, vol_spike, rsi_div)

    return {
        "live": True,
        "symbol": "XAUUSD",
        "entryTf": entry_tf,
        "currentPrice": float(current_price),
        "session": session,
        "so9PivotKey": so9_pivot_key,
        "so9PivotPrice": float(pivot_price),
        "oddEven": odd_even,
        "fineAbove": fine_above,
        "fineBelow": fine_below,
        "angle": angle,
        "timeSquare": time_square,
        "killzones": killzones,
        "filters": {"volumeSpike": vol_spike, "rsiDivergence": rsi_div},
        "reversalAlert": reversal,
        "timeScaleFactor": time_scale_factor,
        "extensionThresholdAtr": extension_threshold_atr,
    }
