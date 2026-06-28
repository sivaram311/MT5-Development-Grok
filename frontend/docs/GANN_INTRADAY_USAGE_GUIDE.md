# Gann Intraday — Usage Guide & Tutorial

**Route:** `/dashboard/gann-intraday`  
**Local dev:** `http://localhost:4200/dashboard/gann-intraday`  
**Symbol:** XAUUSD (Gold)

This guide explains how to **use** the Gann Intraday page in practice — what each section means, how to adjust controls, and how to read reversal confluence. For implementation status and API details, see [gann-intraday-pending-implementation.md](../../docs/gann-intraday-pending-implementation.md) and [api-endpoints.md](../../docs/api-endpoints.md).

---

## 1. What this page is for

Gann Intraday is an **intraday mean-reversion and reversal** dashboard. It combines five Gann-style modules into one scrollable study:

| # | Module | Trading idea |
|---|--------|--------------|
| 1 | **1×1 Gann angle** | Price stretched too far from equilibrium → fade back toward the 1×1 line |
| 2 | **Session pivots** | Anchor levels from prior day and current NY/London session |
| 3 | **Square of Nine** | Fine and odd/even price magnets around a chosen pivot |
| 4 | **Time squaring** | When elapsed session time and price move align (45 / 90 / 180 min) |
| 5 | **Killzones + confluence** | Only trust setups during high-probability session windows |

The page is **not** a signal service. It scores **confluence** so you can decide when a mean-reversion or reversal idea has enough alignment to act on.

---

## 2. Before you open the page

### Prerequisites

1. **Log in** — JWT required for API and SSE.
2. **Backend running** — Spring Boot on `http://localhost:8080` (or your configured `apiUrl`).
3. **Market data** — M5, M15, and D1 grids must have recent candles with `nyTime` on M15 (session logic depends on it).

```powershell
# Terminal: MT5 logged in, then from grok_dev/python:
python run_data_downloader.py
```

4. **(Optional) Live publisher** — for `LIVE` badge and faster server-side snapshots:

```powershell
cd python
python run_gann_intraday.py
```

5. **(Optional) MT5 scanner EA** — copy `GrokDevGannScanner.ex5` from `python/mt5_scripts/` to MT5 Experts; writes `grok_dev_gann_scanner.json`. See [mt5_scripts/README.md](../../python/mt5_scripts/README.md).

### How to navigate there

| Device | Path |
|--------|------|
| **Sidebar (tablet/desktop)** | **Gann Intraday** in the left nav |
| **Phone bottom nav** | **More** → **Gann Intraday** |
| **Direct URL** | `/dashboard/gann-intraday` |
| **Dashboard alert** | Tap **Open Gann Intraday** on the red/amber reversal banner |

---

## 3. Page layout (top to bottom)

When data loads, the page shows these blocks in order:

```
┌─────────────────────────────────────────┐
│ Header: status badge · Docs · controls  │
├─────────────────────────────────────────┤
│ Reversal confluence banner (severity)   │
├─────────────────────────────────────────┤
│ Session summary cards (PDH, PDL, NY…)   │
├─────────────────────────────────────────┤
│ 1×1 Gann angle + 45° fan table          │
├─────────────────────────────────────────┤
│ Square of Nine table (fine + odd/even)  │
├─────────────────────────────────────────┤
│ Time squaring milestones                │
├─────────────────────────────────────────┤
│ NY killzones list                       │
├─────────────────────────────────────────┤
│ Volume & RSI divergence filters         │
└─────────────────────────────────────────┘
```

**Pull down** anywhere on the page to refresh (mobile haptic). Use **Refresh** in the toolbar for an explicit reload.

---

## 4. Header controls

### Status badge

| Badge | Meaning |
|-------|---------|
| **LIVE** (green) | SSE stream connected — server is pushing live `gann-intraday` snapshots |
| **GRID** (neutral) | Study computed from REST API or local grid fallback |
| **OFFLINE DATA** (amber) | Cached IndexedDB grids — pipeline may be down |

The study numbers always render from your latest refresh; SSE mainly keeps the badge live and feeds the **dashboard alert banner** when you are on other pages.

### Entry timeframe (M5 / M15)

Chooses which bar series drives **current price**, ATR, reversal candle patterns, volume spike, and RSI divergence.

| Choice | Best for |
|--------|----------|
| **M5** | Tighter entries, more noise |
| **M15** | Smoother context, fewer false flips |

Changing entry TF triggers an automatic refresh.

### So9 pivot source

Sets the **center price** for Square of Nine (odd/even + fine steps) and labels the pivot card.

| Pivot | Source |
|-------|--------|
| **NY open** (default) | First M15 bar of NY session (08:00 NY) |
| **London open** | First M15 bar of London window (03:00–05:00 NY) |
| **PDH / PDL** | Previous D1 high / low |
| **Prev close** | Previous D1 close |
| **NY high / NY low** | Running session extremes |
| **London high / London low** | London window extremes |

**Tip:** Use **NY open** for US-session mean reversion. Switch to **PDH/PDL** when price is reacting to prior-day structure.

### Time scale (0.5 – 2.0)

Scales Gann **time–price equality** in the Time squaring section. At `1.0`, a 45-minute milestone expects ~45 points of move (before near-square tolerance). Lower values tighten targets; higher values widen them.

### ATR alert (0.75 – 2.5×)

Threshold for **1×1 overextension** and the dedicated **ATR THRESHOLD** badge. Default **1.25× ATR** — price must deviate at least that many ATRs from equilibrium to count as stretched.

### Odd Sq / Even Sq toggles

In the Square of Nine table:

- **Odd squares** — `(√pivot ± 2n)²` (violet rows)
- **Even squares** — `(√pivot ± (2n±1))²` (indigo rows)
- **Fine steps** (teal) — always shown: `±n×0.25`, `±n×0.5`, `±n×1.0` with 45° / 90° / 180° hints

Prices **near current price** highlight in **emerald** (within ~0.08% or 0.5 points).

---

## 5. Module guide — how to read each section

### 5.1 Reversal confluence banner

The top banner is the **headline score** for the whole page.

| Severity | Typical meaning | Suggested action |
|----------|-----------------|------------------|
| **HIGH** (red) | Score ≥ 5 — multiple factors aligned | Review for A+ mean-reversion; use 1×1 equilibrium as first target |
| **MEDIUM** (amber) | Score 3–4 — partial confluence | Watch for rejection at So9 or equilibrium; do not chase |
| **LOW** (gray) | Score 1–2 — early warning | Wait for killzone + stretch + level |
| **NONE** | No active setup | No trade bias from this module |

**Reason bullets** explain what contributed. Example reasons:

- `1×1 alert — stretched above (1.4× ATR)`
- `At Square of Nine level`
- `Time squaring milestone`
- `Killzone: NY Open`
- `Reversal candle pattern`
- `Volume spike vs 20-bar avg`
- `RSI bearish divergence`

#### Confluence scoring (reference)

| Factor | Points |
|--------|--------|
| 1×1 alert (at/above threshold) | +2 |
| 1×1 overextended (below threshold) | +2 |
| Price at So9 level | +1 |
| Time squaring near milestone | +1 |
| Active killzone | +1 |
| Reversal candle (pin / engulf) | +1 |
| Volume spike | +1 |
| RSI divergence | +1 |

---

### 5.2 Session summary cards

Quick reference levels before you scroll:

| Card | Use |
|------|-----|
| **PDH / PDL** | Prior-day range — breakout vs fade context |
| **NY open** | Default session anchor (emerald) |
| **So9 pivot** | Active pivot price and label |
| **Current · M5/M15** | Live price on entry TF |
| **London open** | European session anchor |
| **Killzones active** | Which windows are **ACTIVE** right now |

---

### 5.3 1×1 Gann angle

**Concept:** From the session origin bar, price should rise along a **1×1 line** at slope = **ATR(14) per bar** (on entry TF). Deviation from that line measures stretch.

| Field | Meaning |
|-------|---------|
| **Equilibrium** | Expected price on the 1×1 line at the current bar |
| **Deviation** | Current − equilibrium (points and × ATR) |
| **1×1 slope / bar** | ATR-based rise per bar |
| **Bias** | Balanced · Overextended ↑ · Overextended ↓ |
| **1×1 alert** | Deviation crossed your ATR threshold |

**45° fan table** projects forward prices for **1×1**, **2×1** (steeper), and **1×2** (shallower) for the next bars. Use as **targets** or **stop-reference** when fading stretch.

**Mean-reversion workflow:**

1. Bias shows **Overextended ↑** during an active killzone.
2. Price tags a So9 level (emerald highlight in table).
3. Reversal banner rises to **MEDIUM** or **HIGH**.
4. First target: **equilibrium** on the 1×1 line; partial at nearest fine So9 below.

---

### 5.4 Square of Nine

Single merged table — **fine levels** (teal) outside **odd/even** bands (violet/indigo), **pivot** centered in amber.

| Row type | Formula (concept) |
|----------|-------------------|
| Fine `+n×0.25` | `(√pivot + 0.25n)²` — 45° step |
| Fine `+n×0.5` | 90° step |
| Fine `+n×1.0` | 180° step |
| Odd OS↑n | `(√pivot + 2n)²` |
| Even ES↑n | `(√pivot + (2n±1))²` |

Rows sort by distance from pivot — furthest above at top, nearest below just under pivot.

---

### 5.5 Time squaring

Measures **minutes since NY session open** vs **price move from NY open**.

| Field | Meaning |
|-------|---------|
| **Price move** | Signed move from session open |
| **Abs move** | Absolute points moved |
| **$/min** | Average pace |
| **45 / 90 / 180 min** | Milestones with **target** price and **NEAR SQUARE** flag |

**NEAR SQUARE** lights when time is within ~5 min of a milestone, price is near the target, or time–price equality is within tolerance (scaled by **Time scale**).

Gann idea: when **time** and **price** “square,” reversals are more likely — especially combined with 1×1 stretch and So9.

---

### 5.6 NY killzones

Session windows (NY time, with **IST** shown for Indian traders):

| Zone | NY window | IST (approx.) |
|------|-----------|---------------|
| **London Open** | 03:00–05:00 | 13:30–15:30 |
| **NY Open** | 08:00–10:00 | 17:30–19:30 |
| **NY Overlap** | 08:00–11:00 | 17:30–20:30 |
| **NY Afternoon** | 14:00–17:00 | 23:30–02:30 |

**ACTIVE** = current M15 `nyTime` falls inside the window. Confluence scoring only adds killzone points when a zone is active.

---

### 5.7 Volume & RSI filters

Supporting filters — not standalone signals:

| Badge | Logic |
|-------|-------|
| **VOLUME SPIKE** | Latest bar tick volume > 1.8× 20-bar average |
| **RSI bearish/bullish div** | 5-bar price vs RSI divergence on entry TF |
| **Volume normal / No RSI divergence** | Filters inactive |

These add +1 each to the reversal score when present.

---

## 6. Data sources — what powers the numbers

```
                    ┌──────────────────────┐
                    │  MT5 + Python sync   │
                    │  (M5, M15, D1 grid)  │
                    └──────────┬───────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  REST /gann-intraday    Grid fallback          SSE /stream
  (Java calculator)      (client utils)         (live snapshot)
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                               ▼
                    Gann Intraday page UI
```

On each **Refresh**:

1. Page calls `GET /api/market/xauusd/gann-intraday` with your controls (`entry_tf`, `so9_pivot`, `time_scale`, `atr_threshold`).
2. If the API fails or returns no study, it falls back to **client-side** `computeGannIntradayStudy()` from cached grids.
3. **SSE** runs in parallel — when connected, badge shows **LIVE**; snapshots can update the banner on the main dashboard via `GannAlertBannerComponent`.

Page refresh uses `prefer_live=false` so your **slider and pivot choices** always recompute through the API path.

---

## 7. Step-by-step tutorials

### Tutorial A — NY open fade (classic mean reversion)

1. Open page during **NY Open** killzone (check **Killzones active** card).
2. Keep **Entry TF = M5**, **So9 pivot = NY open**.
3. Wait for **Bias = Overextended ↑** and deviation ≥ your ATR alert.
4. Confirm price highlights a **teal or violet** So9 row (emerald text).
5. Check banner for **MEDIUM** or **HIGH** with So9 + 1×1 + killzone reasons.
6. Plan entry on rejection candle; target **Equilibrium**, stop beyond last fine level.

### Tutorial B — Prior-day level reaction

1. Set **So9 pivot = PDH** (or **PDL** if fading lows).
2. Use **M15** entry TF for cleaner structure.
3. Watch **Current** price vs pivot row — reactions at pivot often coincide with odd/even bands.
4. Lower **ATR alert** to 1.0× if you want earlier stretch warnings.

### Tutorial C — Time squaring reversal

1. Note **minutes elapsed** in Time squaring header.
2. When **90 min** row shows **NEAR SQUARE**, check if **Abs move** ≈ 90 × **Time scale**.
3. If 1×1 also shows stretch **opposite** to the session move, favor reversal toward NY open / equilibrium.

### Tutorial D — Monitoring from dashboard

1. Stay on Market or Analyzer page.
2. When **Gann reversal high/medium** banner appears, tap **Open Gann Intraday**.
3. Read reason bullets before acting — dismiss banner with **✕** (stays dismissed until reload).

---

## 8. Dashboard alert banner

Rendered at the top of the dashboard shell (`GannAlertBannerComponent`):

- Fires on **high** or **medium** severity from SSE or from the page’s own refresh.
- **Dismiss** is session-local (service `dismissAlert()`).
- Link returns you to this page for full context.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty state: “Could not compute…” | Missing D1 or M15 `nyTime` | Run Python downloader; verify `/api/market/xauusd/M15/grid` |
| NY open / London open shows **—** | No M15 bars in session yet | Wait for session start or check timezone config |
| Badge stuck on **GRID** | SSE not connected or no publisher | Log in again; start backend; optional `run_gann_intraday.py` |
| **OFFLINE DATA** | Backend unreachable | Restore network; cached grids still compute locally |
| Killzones always **idle** | `nyTime` missing on latest bar | Fix pipeline / broker zone (`BROKER_SERVER_ZONE`) |
| Numbers differ from MT5 | Different pivot or TF | Match **So9 pivot** and **Entry TF** to your chart |

---

## 10. Related pages & files

| Resource | Location |
|----------|----------|
| **This guide (in-app)** | Docs → **Gann Intraday** accordion |
| **Implementation tracker** | [docs/gann-intraday-pending-implementation.md](../../docs/gann-intraday-pending-implementation.md) |
| **API reference** | [docs/api-endpoints.md](../../docs/api-endpoints.md) |
| **Component** | [gann-intraday.component.ts](../src/app/dashboard/gann-intraday.component.ts) |
| **Orchestrator** | [gann-intraday.util.ts](../src/app/utils/gann-intraday.util.ts) |
| **Analyzer (RSI / So9 grids)** | `/dashboard/order-rsi` — multi-TF; different use case |
| **Analysis Lab Gann** | `/dashboard/analysis` — swing octave on D1/H4/H1 |

---

## 11. Quick reference card

| Control | Default | Effect |
|---------|---------|--------|
| Entry TF | M5 | Price, ATR, candles, filters |
| So9 pivot | NY open | Center of So9 table |
| Time scale | 1.0 | Time squaring sensitivity |
| ATR alert | 1.25× | 1×1 stretch threshold |
| Odd / Even Sq | Both on | Show odd/even bands |

**URL:** `http://localhost:4200/dashboard/gann-intraday`  
**API:** `GET /api/market/xauusd/gann-intraday?entry_tf=M5&so9_pivot=nyOpen&time_scale=1.0&atr_threshold=1.25`
