# Gann Intraday XAUUSD — Pending Implementation Tracker

Live page: **`/dashboard/gann-intraday`** (Gann Intraday)

This document tracks the five-module intraday Gann framework for gold mean reversion & reversals. Initial implementation is **frontend-first** (grid data + client-side math). Backend/live-stream enhancements are listed under **Future**.

## Status legend

| Status | Meaning |
|--------|---------|
| **V1 Live** | On Gann Intraday page — first working version |
| **Partial** | UI + core math; needs tuning / backend |
| **Planned** | Not started |

---

## Module 1 — 1×1 Gann angle (mean reversion)

**Goal:** Show equilibrium line vs current price; flag overextension from 1×1 for intraday fade setups.

| Item | Status | Notes |
|------|--------|-------|
| Equilibrium from session pivot + 1×1 slope (ATR/bar) | **V1 Live** | `gann-angle.util.ts` |
| Deviation in points & ATR multiples | **V1 Live** | Bias: balanced / overextended up/down |
| Chart-scaled 45° fan overlay | **Planned** | MT5 indicator |
| Auto alerts on X× ATR from 1×1 | **Partial** | Killzone module surfaces combined alert |

**Future:** Python publisher or MQL5 fan with adjustable scale; SSE push.

---

## Module 2 — Session-aware pivots (PDH/PDL, NY open)

**Goal:** So9 and angles anchored to session references, not only MT5 bar 0/1.

| Item | Status | Notes |
|------|--------|-------|
| PDH / PDL / prev D1 close | **V1 Live** | From D1 grid |
| NY session high / low / open (M15 nyTime) | **V1 Live** | `gann-session-pivot.util.ts` |
| So9 from each pivot source | **V1 Live** | Odd/even bands on page |
| London open anchor | **Partial** | Uses NY 08:00 window proxy |

**Future:** Dedicated session calendar; broker vs NY alignment config.

---

## Module 3 — Finer Square of Nine steps (0.25 / 0.5 / 1.0)

**Goal:** Cardinal (45°/90°/180°) √ increments alongside odd/even diagonals.

| Item | Status | Notes |
|------|--------|-------|
| `(√P ± 0.25n)²` levels | **V1 Live** | `gann-so9-fine.util.ts` |
| 0.5 & 1.0 step labels (90° / 180°) | **V1 Live** | Table on page |
| Merge sort around pivot (Analyzer pattern) | **V1 Live** | Shared row builder |

**Future:** Sync with Analyzer live SSE; MT5 overlay plotter.

---

## Module 4 — Time squaring (price ↔ time)

**Goal:** Highlight when elapsed session minutes align with price move (45/90/180 min milestones).

| Item | Status | Notes |
|------|--------|-------|
| Minutes from NY session open | **V1 Live** | `gann-time-square.util.ts` |
| Price move from session open | **V1 Live** | |
| Milestones 45 / 90 / 180 min | **V1 Live** | “Near square” flags |
| Full Gann time–price equality scale | **Partial** | Configurable scale factor TBD |

**Future:** Clock-time Gann cycles; IST killzone timestamps in payload.

---

## Module 5 — Killzone + reversal confluence

**Goal:** Filter setups to NY open / overlap windows; surface A+ reversal confluence.

| Item | Status | Notes |
|------|--------|-------|
| NY open & overlap killzones (nyTime) | **V1 Live** | `gann-killzone.util.ts` |
| Combined alert: 1×1 stretch + So9 + time square + candle | **V1 Live** | Severity high/medium/low |
| MQL5 scanner / push notifications | **Planned** | See Module 1 alerts |
| Volume / divergence filters | **Planned** | |

**Future:** `GrokDevGannScanner.mq5`; webhook to dashboard banner.

---

## Data sources (V1)

| Data | Endpoint |
|------|----------|
| M5 / M15 / H1 / D1 candles | `GET /api/market/xauusd/{tf}/grid` |
| Live tick (optional later) | Order RSI SSE |

## Related docs

- [order-rsi-mt5-alignment.md](./order-rsi-mt5-alignment.md) — Analyzer So9 grids (Bar 0 open / Bar 1 close)
- [ANGULAR_FRONTEND.md](../frontend/docs/ANGULAR_FRONTEND.md) — Gann Intraday page

## Changelog (this doc)

| Date | Change |
|------|--------|
| 2026-06-28 | V1 page ships all five modules (frontend); route `/dashboard/gann-intraday` live |
