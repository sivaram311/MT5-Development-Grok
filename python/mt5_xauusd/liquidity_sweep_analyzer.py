"""NY liquidity sweep + structure reference + multi-TF RSI confluence detector."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from .gann_intraday_util import LONDON_SESSION_END, LONDON_SESSION_START, compute_session_pivots
from .liquidity_tf_util import tf_minutes
from .rsi_util import wilder_rsi_at_index


@dataclass
class LiquiditySweepConfig:
    """Tunable detection parameters (defaults match product spec)."""
    ny_session_start_min: int = 8 * 60          # 08:00 NY
    ny_session_end_min: int = 17 * 60           # 17:00 NY
    sweep_buffer_pips: float = 3.0
    structure_tolerance_pips: float = 6.0
    max_time_after_sweep_min: int = 90
    rsi_htf_threshold: float = 38.0
    rsi_ltf_entry_zone: float = 35.0
    pip_size: float = 0.10
    swing_lookback: int = 2
    max_swings: int = 15
    outcome_bars: int = 48
    entry_offset_pips: float = 2.0
    sl_offset_pips: float = 4.0
    entry_tf: str = "M15"
    htf: str = "H1"
    ltf: str = "M15"


@dataclass
class LiquiditySetup:
    setup_id: str
    date: str
    ny_time: str
    ist_time: str
    direction: str
    sweep_level: float
    structure_level: float
    entry: float
    sl: float
    tp1: float
    tp2: float
    result: str
    rr_achieved: Optional[float]
    rsi_htf: Optional[float]
    rsi_ltf: Optional[float]
    notes: str
    sweep_time: str = ""
    structure_time: str = ""
    how_spotted: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        base = asdict(self)
        base["payload"] = self.payload or {}
        return base


def _parse_ny_parts(ny_time: str | None) -> Optional[Tuple[str, int, int]]:
    if not ny_time:
        return None
    m = re.match(r"^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})", str(ny_time))
    if not m:
        return None
    return m.group(1), int(m.group(2)), int(m.group(3))


def _ny_minutes(ny_time: str | None) -> Optional[int]:
    p = _parse_ny_parts(ny_time)
    if not p:
        return None
    return p[1] * 60 + p[2]


def _in_ny_session(ny_time: str | None, cfg: LiquiditySweepConfig) -> bool:
    mins = _ny_minutes(ny_time)
    if mins is None:
        return False
    return cfg.ny_session_start_min <= mins < cfg.ny_session_end_min


def _parse_dt(value: str) -> Optional[datetime]:
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt)
        except ValueError:
            continue
    return None


def _minutes_between(a: str, b: str) -> Optional[float]:
    da, db = _parse_dt(a), _parse_dt(b)
    if not da or not db:
        return None
    return abs((db - da).total_seconds()) / 60.0


def find_swings(bars: List[dict], lookback: int = 2) -> Tuple[List[dict], List[dict]]:
    """Return swing lows and swing highs (chronological bars)."""
    lows: List[dict] = []
    highs: List[dict] = []
    if len(bars) < lookback * 2 + 1:
        return lows, highs
    for i in range(lookback, len(bars) - lookback):
        low = float(bars[i].get("low") or bars[i].get("close") or 0)
        high = float(bars[i].get("high") or bars[i].get("close") or 0)
        window_lows = [float(bars[j].get("low") or bars[j].get("close") or 0) for j in range(i - lookback, i + lookback + 1)]
        window_highs = [float(bars[j].get("high") or bars[j].get("close") or 0) for j in range(i - lookback, i + lookback + 1)]
        if low <= min(window_lows):
            lows.append({"index": i, "price": low, "time": bars[i].get("time"), "nyTime": bars[i].get("nyTime")})
        if high >= max(window_highs):
            highs.append({"index": i, "price": high, "time": bars[i].get("time"), "nyTime": bars[i].get("nyTime")})
    return lows, highs


def _asian_low(m15: List[dict], session_date: str) -> Optional[float]:
    lows = []
    for c in m15:
        p = _parse_ny_parts(c.get("nyTime") or c.get("time"))
        if not p or p[0] != session_date:
            continue
        mins = p[1] * 60 + p[2]
        if LONDON_SESSION_START <= mins < LONDON_SESSION_END:
            val = c.get("low")
            if val is not None:
                lows.append(float(val))
    return min(lows) if lows else None


def _asian_high(m15: List[dict], session_date: str) -> Optional[float]:
    highs = []
    for c in m15:
        p = _parse_ny_parts(c.get("nyTime") or c.get("time"))
        if not p or p[0] != session_date:
            continue
        mins = p[1] * 60 + p[2]
        if LONDON_SESSION_START <= mins < LONDON_SESSION_END:
            val = c.get("high")
            if val is not None:
                highs.append(float(val))
    return max(highs) if highs else None


def _rsi_at_bar(tf_bars: List[dict], target_time: str, period: int = 14) -> Optional[float]:
    """tf_bars chronological ASC; find bar at/just before target_time."""
    idx = None
    target = _parse_dt(target_time)
    if not target:
        return None
    for i, b in enumerate(tf_bars):
        bt = _parse_dt(str(b.get("time") or ""))
        if bt and bt <= target:
            idx = i
    if idx is None or idx < period:
        return None
    closes = [float(x.get("close") or 0) for x in tf_bars[: idx + 1]]
    return wilder_rsi_at_index(closes, period)


def _bullish_divergence(ltf_bars: List[dict], struct_idx: int, lookback: int = 8) -> bool:
    if struct_idx < lookback + 1:
        return False
    slice_bars = ltf_bars[max(0, struct_idx - lookback) : struct_idx + 1]
    if len(slice_bars) < 4:
        return False
    closes = [float(b.get("close") or 0) for b in slice_bars]
    lows = [float(b.get("low") or b.get("close") or 0) for b in slice_bars]
    rsi_vals = []
    for i in range(len(slice_bars)):
        if i < 14:
            rsi_vals.append(None)
        else:
            rsi_vals.append(wilder_rsi_at_index(closes[: i + 1], 14))
    valid = [(lows[i], rsi_vals[i]) for i in range(len(slice_bars)) if rsi_vals[i] is not None]
    if len(valid) < 2:
        return False
    (l1, r1), (l2, r2) = valid[-2], valid[-1]
    return l2 < l1 and r2 > r1


def _bearish_divergence(ltf_bars: List[dict], struct_idx: int, lookback: int = 8) -> bool:
    if struct_idx < lookback + 1:
        return False
    slice_bars = ltf_bars[max(0, struct_idx - lookback) : struct_idx + 1]
    closes = [float(b.get("close") or 0) for b in slice_bars]
    highs = [float(b.get("high") or b.get("close") or 0) for b in slice_bars]
    rsi_vals = []
    for i in range(len(slice_bars)):
        if i < 14:
            rsi_vals.append(None)
        else:
            rsi_vals.append(wilder_rsi_at_index(closes[: i + 1], 14))
    valid = [(highs[i], rsi_vals[i]) for i in range(len(slice_bars)) if rsi_vals[i] is not None]
    if len(valid) < 2:
        return False
    (h1, r1), (h2, r2) = valid[-2], valid[-1]
    return h2 > h1 and r2 < r1


def _displacement_bullish(bar: dict, avg_body: float) -> bool:
    o, c, h, l = float(bar.get("open") or 0), float(bar.get("close") or 0), float(bar.get("high") or 0), float(bar.get("low") or 0)
    body = abs(c - o)
    return c > o and body >= avg_body * 0.8


def _displacement_bearish(bar: dict, avg_body: float) -> bool:
    o, c = float(bar.get("open") or 0), float(bar.get("close") or 0)
    body = abs(c - o)
    return c < o and body >= avg_body * 0.8


def _simulate_outcome(
    bars_after: List[dict],
    direction: str,
    entry: float,
    sl: float,
    tp1: float,
    tp2: float,
) -> Tuple[str, Optional[float]]:
    risk = abs(entry - sl)
    if risk <= 0:
        return "Open", None
    for bar in bars_after:
        high = float(bar.get("high") or bar.get("close") or 0)
        low = float(bar.get("low") or bar.get("close") or 0)
        if direction == "Bullish":
            if low <= sl:
                return "Loss", round(-1.0, 2)
            if high >= tp2:
                return "Win", round((tp2 - entry) / risk, 2)
            if high >= tp1:
                return "Win", round((tp1 - entry) / risk, 2)
        else:
            if high >= sl:
                return "Loss", round(-1.0, 2)
            if low <= tp2:
                return "Win", round((entry - tp2) / risk, 2)
            if low <= tp1:
                return "Win", round((entry - tp1) / risk, 2)
    return "Open", None


def _setup_id(date: str, ny_time: str, direction: str, entry_tf: str) -> str:
    clean = re.sub(r"[^0-9]", "", ny_time)[:12]
    return f"XAU_{date}_{clean}_{direction[0]}_{entry_tf}"


def _bar_idx_at_time(bars: List[dict], target_time: str) -> Optional[int]:
    return next((j for j, b in enumerate(bars) if b.get("time") == target_time), None)


def _dedupe_setups(setups: List[LiquiditySetup]) -> List[LiquiditySetup]:
    """One setup per direction + structure time; prefer Win, then highest R:R."""
    rank = {"Win": 3, "Open": 2, "Loss": 1}
    best: Dict[Tuple[str, str], LiquiditySetup] = {}
    for s in setups:
        key = (s.direction, s.structure_time or s.ny_time)
        cur = best.get(key)
        if cur is None:
            best[key] = s
            continue
        s_rank = rank.get(s.result, 0)
        c_rank = rank.get(cur.result, 0)
        s_rr = s.rr_achieved if s.rr_achieved is not None else -999.0
        c_rr = cur.rr_achieved if cur.rr_achieved is not None else -999.0
        if s_rank > c_rank or (s_rank == c_rank and s_rr > c_rr):
            best[key] = s
    out = list(best.values())
    out.sort(key=lambda x: (x.date, x.ny_time))
    return out


def scan_day_setups(
    entry_bars: List[dict],
    tf_bars: Dict[str, List[dict]],
    d1: List[dict],
    cfg: Optional[LiquiditySweepConfig] = None,
) -> List[LiquiditySetup]:
    """Scan one NY session day on the entry timeframe with HTF/LTF RSI confluence."""
    cfg = cfg or LiquiditySweepConfig()
    htf_bars = tf_bars.get(cfg.htf, [])
    ltf_bars = tf_bars.get(cfg.ltf, [])
    m15 = tf_bars.get("M15", [])
    bar_min = tf_minutes(cfg.entry_tf)
    if len(entry_bars) < 30:
        return []

    latest_ny = _parse_ny_parts(entry_bars[-1].get("nyTime") or entry_bars[-1].get("time"))
    session_date = latest_ny[0] if latest_ny else entry_bars[-1].get("time", "")[:10]

    session = compute_session_pivots(d1 or [], m15, session_date=session_date)
    if not session:
        return []

    pdl = session.get("pdl")
    pdh = session.get("pdh")
    asian_low = _asian_low(m15, session_date)
    asian_high = _asian_high(m15, session_date)

    ny_bars = [b for b in entry_bars if _in_ny_session(b.get("nyTime") or b.get("time"), cfg)]
    if not ny_bars:
        return []

    running_low = min(float(b.get("low") or b.get("close") or 1e9) for b in ny_bars[:1])
    running_high = max(float(b.get("high") or b.get("close") or 0) for b in ny_bars[:1])

    swing_lows, swing_highs = find_swings(entry_bars[: entry_bars.index(ny_bars[0]) + len(ny_bars)], cfg.swing_lookback)
    swing_lows = swing_lows[-cfg.max_swings :]
    swing_highs = swing_highs[-cfg.max_swings :]

    setups: List[LiquiditySetup] = []
    tol = cfg.structure_tolerance_pips * cfg.pip_size
    sweep_buf = cfg.sweep_buffer_pips * cfg.pip_size
    max_future = max(1, cfg.max_time_after_sweep_min // bar_min)
    outcome_bars_n = max(4, (cfg.outcome_bars * 5) // bar_min)

    bodies = [abs(float(b.get("close") or 0) - float(b.get("open") or 0)) for b in entry_bars[-40:]]
    avg_body = sum(bodies) / len(bodies) if bodies else 1.0
    how_base = f"NY Sweep + Structure + {cfg.htf}/{cfg.ltf} RSI ({cfg.entry_tf} entry)"

    for i, bar in enumerate(ny_bars):
        bar_idx = entry_bars.index(bar)
        low = float(bar.get("low") or bar.get("close") or 0)
        high = float(bar.get("high") or bar.get("close") or 0)
        running_low = min(running_low, low)
        running_high = max(running_high, high)

        sig_lows = [x for x in [pdl, asian_low] if x is not None]
        sig_lows.append(running_low if i > 0 else None)
        sig_lows = [x for x in sig_lows if x is not None]
        sig_highs = [x for x in [pdh, asian_high] if x is not None]
        sig_highs.append(running_high if i > 0 else None)
        sig_highs = [x for x in sig_highs if x is not None]

        # Bullish sweep
        for sig in sig_lows:
            if low < sig - sweep_buf:
                sweep_level = low
                sweep_time = str(bar.get("time") or "")
                future = entry_bars[bar_idx + 1 : bar_idx + 1 + max_future]
                for fb in future:
                    mins = _minutes_between(sweep_time, str(fb.get("time") or ""))
                    if mins is not None and mins > cfg.max_time_after_sweep_min:
                        break
                    close = float(fb.get("close") or 0)
                    for sw in swing_lows:
                        if sw["index"] >= bar_idx:
                            continue
                        if abs(close - sw["price"]) <= tol:
                            struct_time = str(fb.get("time") or "")
                            htf_rsi = _rsi_at_bar(htf_bars, struct_time)
                            ltf_idx = _bar_idx_at_time(ltf_bars, struct_time)
                            ltf_rsi = _rsi_at_bar(ltf_bars, struct_time)
                            div = _bullish_divergence(ltf_bars, ltf_idx or 0) if ltf_idx is not None else False
                            rsi_ok = (
                                htf_rsi is not None
                                and htf_rsi > cfg.rsi_htf_threshold
                                and (
                                    (ltf_rsi is not None and ltf_rsi > cfg.rsi_ltf_entry_zone)
                                    or div
                                )
                            )
                            if not rsi_ok:
                                continue
                            if not _displacement_bullish(fb, avg_body) and close <= sweep_level:
                                continue
                            entry = close + cfg.entry_offset_pips * cfg.pip_size
                            sl = sweep_level - cfg.sl_offset_pips * cfg.pip_size
                            risk = entry - sl
                            tp1 = sw["price"] + risk * 1.5
                            tp2 = sw["price"] + risk * 2.5
                            fb_idx = entry_bars.index(fb)
                            outcome_slice = entry_bars[fb_idx + 1 : fb_idx + 1 + outcome_bars_n]
                            result, rr = _simulate_outcome(outcome_slice, "Bullish", entry, sl, tp1, tp2)
                            ny_t = fb.get("nyTime") or fb.get("time") or ""
                            ist_t = fb.get("istTime") or ""
                            date = session_date
                            notes = f"Sweep PDL/Asian/running low @ {sweep_level:.2f}; return to swing {sw['price']:.2f}"
                            how = how_base
                            if div:
                                how += " + Bullish Div"
                            setup = LiquiditySetup(
                                setup_id=_setup_id(date, ny_t, "Bullish", cfg.entry_tf),
                                date=date,
                                ny_time=str(ny_t)[11:16] if len(str(ny_t)) > 11 else str(ny_t),
                                ist_time=str(ist_t)[11:16] if len(str(ist_t)) > 11 else str(ist_t),
                                direction="Bullish",
                                sweep_level=round(sweep_level, 2),
                                structure_level=round(sw["price"], 2),
                                entry=round(entry, 2),
                                sl=round(sl, 2),
                                tp1=round(tp1, 2),
                                tp2=round(tp2, 2),
                                result=result,
                                rr_achieved=rr,
                                rsi_htf=round(htf_rsi, 1) if htf_rsi else None,
                                rsi_ltf=round(ltf_rsi, 1) if ltf_rsi else None,
                                notes=notes,
                                sweep_time=sweep_time,
                                structure_time=struct_time,
                                how_spotted=how,
                                payload={
                                    "sweepBarIndex": bar_idx,
                                    "structureBarIndex": fb_idx,
                                    "significantLevel": round(sig, 2),
                                    "sweepTime": sweep_time,
                                    "structureTime": struct_time,
                                    "entryTf": cfg.entry_tf,
                                    "htf": cfg.htf,
                                    "ltf": cfg.ltf,
                                },
                            )
                            setups.append(setup)
                            break
                break

        # Bearish sweep (mirror)
        for sig in sig_highs:
            if high > sig + sweep_buf:
                sweep_level = high
                sweep_time = str(bar.get("time") or "")
                future = entry_bars[bar_idx + 1 : bar_idx + 1 + max_future]
                for fb in future:
                    mins = _minutes_between(sweep_time, str(fb.get("time") or ""))
                    if mins is not None and mins > cfg.max_time_after_sweep_min:
                        break
                    close = float(fb.get("close") or 0)
                    for sw in swing_highs:
                        if sw["index"] >= bar_idx:
                            continue
                        if abs(close - sw["price"]) <= tol:
                            struct_time = str(fb.get("time") or "")
                            htf_rsi = _rsi_at_bar(htf_bars, struct_time)
                            ltf_idx = _bar_idx_at_time(ltf_bars, struct_time)
                            ltf_rsi = _rsi_at_bar(ltf_bars, struct_time)
                            div = _bearish_divergence(ltf_bars, ltf_idx or 0) if ltf_idx is not None else False
                            rsi_ok = (
                                htf_rsi is not None
                                and htf_rsi < (100 - cfg.rsi_htf_threshold)
                                and (
                                    (ltf_rsi is not None and ltf_rsi < (100 - cfg.rsi_ltf_entry_zone))
                                    or div
                                )
                            )
                            if not rsi_ok:
                                continue
                            if not _displacement_bearish(fb, avg_body) and close >= sweep_level:
                                continue
                            entry = close - cfg.entry_offset_pips * cfg.pip_size
                            sl = sweep_level + cfg.sl_offset_pips * cfg.pip_size
                            risk = sl - entry
                            tp1 = sw["price"] - risk * 1.5
                            tp2 = sw["price"] - risk * 2.5
                            fb_idx = entry_bars.index(fb)
                            outcome_slice = entry_bars[fb_idx + 1 : fb_idx + 1 + outcome_bars_n]
                            result, rr = _simulate_outcome(outcome_slice, "Bearish", entry, sl, tp1, tp2)
                            ny_t = fb.get("nyTime") or fb.get("time") or ""
                            ist_t = fb.get("istTime") or ""
                            date = session_date
                            notes = f"Sweep PDH/Asian/running high @ {sweep_level:.2f}; return to swing {sw['price']:.2f}"
                            how = how_base
                            if div:
                                how += " + Bearish Div"
                            setup = LiquiditySetup(
                                setup_id=_setup_id(date, ny_t, "Bearish", cfg.entry_tf),
                                date=date,
                                ny_time=str(ny_t)[11:16] if len(str(ny_t)) > 11 else str(ny_t),
                                ist_time=str(ist_t)[11:16] if len(str(ist_t)) > 11 else str(ist_t),
                                direction="Bearish",
                                sweep_level=round(sweep_level, 2),
                                structure_level=round(sw["price"], 2),
                                entry=round(entry, 2),
                                sl=round(sl, 2),
                                tp1=round(tp1, 2),
                                tp2=round(tp2, 2),
                                result=result,
                                rr_achieved=rr,
                                rsi_htf=round(htf_rsi, 1) if htf_rsi else None,
                                rsi_ltf=round(ltf_rsi, 1) if ltf_rsi else None,
                                notes=notes,
                                sweep_time=sweep_time,
                                structure_time=struct_time,
                                how_spotted=how,
                                payload={
                                    "sweepBarIndex": bar_idx,
                                    "structureBarIndex": fb_idx,
                                    "significantLevel": round(sig, 2),
                                    "sweepTime": sweep_time,
                                    "structureTime": struct_time,
                                    "entryTf": cfg.entry_tf,
                                    "htf": cfg.htf,
                                    "ltf": cfg.ltf,
                                },
                            )
                            setups.append(setup)
                            break
                break

    return _dedupe_setups(setups)


def detect_live_setup(
    entry_bars: List[dict],
    tf_bars: Dict[str, List[dict]],
    d1: List[dict],
    cfg: Optional[LiquiditySweepConfig] = None,
) -> Optional[Dict[str, Any]]:
    """Return the most recent in-progress or just-confirmed setup for live SSE."""
    setups = scan_day_setups(entry_bars, tf_bars, d1, cfg)
    if not setups:
        return None
    latest = setups[-1]
    body = latest.to_dict()
    body["live"] = True
    body["symbol"] = "XAUUSD"
    return body
