# Gann Intraday XAUUSD — Implementation Tracker

Live page: **`/dashboard/gann-intraday`** (Gann Intraday)

API: **`GET /api/market/xauusd/gann-intraday`** · SSE **`/gann-intraday/stream`**

Python publisher: **`python run_gann_intraday.py`** · MT5 EA: **`GrokDevGannScanner.mq5`**

## Status legend

| Status | Meaning |
|--------|---------|
| **Live** | Shipped — page, API, and/or publisher |
| **Future** | Optional enhancements |

---

## Module 1 — 1×1 Gann angle (mean reversion)

| Item | Status | Notes |
|------|--------|-------|
| Equilibrium from session pivot + 1×1 slope (ATR/bar) | **Live** | `gann-angle.util.ts`, Java `GannIntradayCalculator` |
| Deviation in points & ATR multiples | **Live** | Bias + dedicated `angleAlert` |
| Chart-scaled 45° fan overlay | **Live** | Fan table 1×1 / 2×1 / 1×2 on page + `fanLines` in API |
| Auto alerts on X× ATR from 1×1 | **Live** | Configurable threshold; dashboard banner on high/medium |

**Future:** Native MT5 chart object fan; webhook push.

---

## Module 2 — Session-aware pivots (PDH/PDL, NY open)

| Item | Status | Notes |
|------|--------|-------|
| PDH / PDL / prev D1 close | **Live** | From D1 grid |
| NY session high / low / open (M15 nyTime) | **Live** | `gann-session-pivot.util.ts` |
| London open / high / low (03:00–05:00 NY) | **Live** | Dedicated pivot source |
| So9 from each pivot source | **Live** | Pivot selector on page |

**Future:** Broker-specific session calendar config UI.

---

## Module 3 — Finer Square of Nine steps (0.25 / 0.5 / 1.0)

| Item | Status | Notes |
|------|--------|-------|
| `(√P ± 0.25n)²` levels | **Live** | `gann-so9-fine.util.ts` |
| 0.5 & 1.0 step labels (90° / 180°) | **Live** | Table on page |
| Merge sort around pivot | **Live** | Shared row builder |

**Future:** Analyzer SSE sync of session pivots.

---

## Module 4 — Time squaring (price ↔ time)

| Item | Status | Notes |
|------|--------|-------|
| Minutes from NY session open | **Live** | `gann-time-square.util.ts` |
| Price move from session open | **Live** | |
| Milestones 45 / 90 / 180 min | **Live** | “Near square” flags |
| Full Gann time–price equality scale | **Live** | Configurable `time_scale` (0.5–2.0) on page + API |

**Future:** Clock-time Gann cycles.

---

## Module 5 — Killzone + reversal confluence

| Item | Status | Notes |
|------|--------|-------|
| NY + London killzones (nyTime) | **Live** | `gann-killzone.util.ts` |
| IST window labels on killzones | **Live** | `istWindow` + `istActive` |
| Combined alert: 1×1 + So9 + time + candle | **Live** | Severity high/medium/low |
| Volume spike filter | **Live** | `gann-volume-divergence.util.ts` |
| RSI divergence filter | **Live** | Bearish/bullish 5-bar |
| MQL5 scanner | **Live** | `GrokDevGannScanner.mq5` → Common Files JSON |
| Dashboard push banner | **Live** | `GannAlertBannerComponent` + SSE |

**Future:** Mobile push notifications; webhook.

---

## Data sources

| Data | Source |
|------|--------|
| REST study | `GET /api/market/xauusd/gann-intraday?entry_tf=M5&so9_pivot=nyOpen&time_scale=1.0&atr_threshold=1.25` |
| Live SSE | `GET /api/market/xauusd/gann-intraday/stream` |
| Grid fallback | M5/M15/D1 `/grid` (client or Java compute) |
| Python live | `grok_dev.live_gann_intraday` via `run_gann_intraday.py` |
| MT5 scanner | `grok_dev_gann_scanner.json` in Terminal Common Files |

## Related docs

- **[GANN_INTRADAY_USAGE_GUIDE.md](../frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md)** — how to use the page (tutorial, controls, workflows)
- [order-rsi-mt5-alignment.md](./order-rsi-mt5-alignment.md)
- [api-endpoints.md](./api-endpoints.md)
- [ANGULAR_FRONTEND.md](../frontend/docs/ANGULAR_FRONTEND.md)

## Changelog (this doc)

| Date | Change |
|------|--------|
| 2026-06-28 | V1 page — five frontend modules |
| 2026-06-28 | Phase 2 — API, SSE, London, fan, filters, MQL5 scanner, banner |
