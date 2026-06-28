# Analyzer (Order RSI) vs MT5 Terminal — Alignment Guide

## Analyzer page (UI)

Bottom nav **Analyzer** (`/dashboard/order-rsi`) shows a **table** — timeframes as **column headers** (W1 → M1):

| Row | Content |
|-----|---------|
| 1 · Bar 0 · RSI | Zone-colored RSI boxes (forming) |
| 2 · Bar 0 · data | Bar time + close (toggle to hide) |
| 3 · Bar 1 · RSI | Zone-colored RSI boxes (closed) |
| 4 · Bar 1 · data | Bar time + close (toggle to hide) |
| 5–11 · **B0SR** | Classic floor pivots from **Bar 0** H/L/C: S3, S2, S1, Pivot, R1, R2, R3 |
| 12–18 · **B1SR** | Classic floor pivots from **Bar 1** H/L/C: S3, S2, S1, Pivot, R1, R2, R3 |

**Show rows** chips on the page toggle each row group on/off (page only, not saved). **B0SR** and **B1SR** each show or hide all seven S/R levels together.

### Classic floor pivots (S/R)

Computed in `run_order_rsi.py` from each bar's **high, low, close**:

| Row label | Formula (published under matching `sr.*` key) |
|-----------|-----------------------------------------------|
| Pivot | (H + L + C) / 3 |
| S1 | 2×P − L |
| R1 | 2×P − H |
| S2 | P + (H − L) |
| R2 | P − (H − L) |
| S3 | H + 2×(P − L) |
| R3 | L − 2×(H − P) |

- **B0SR** — Bar 0 (forming) current H/L/C; updates as the candle forms.
- **B1SR** — Bar 1 (last closed) H/L/C.

API fields: `timeframes.{TF}.sr` (Bar 0), `timeframes.{TF}.completed.sr` (Bar 1).

### Gann Odd Square (Square of Nine)

Two separate tables **below** the RSI / S/R grid:

| Grid | Pivot | API field |
|------|-------|-----------|
| **Bar 1 Close** | Last closed bar **close** | `timeframes.{TF}.gannBar1` |
| **Bar 0 Open** | Forming bar **open** | `timeframes.{TF}.gannBar0` |

Each grid has its own **Odd Sq** / **Even Sq** toggles (page only). **Pivot** row is **centered** when either toggle is on.

**Row order** (one row per band level — OS↑1 and ES↑1 are separate rows when both visible):

| Section | Order (top → bottom) |
|---------|----------------------|
| **Above pivot** | Odd + even **merged**, sorted by distance from pivot — **furthest / highest at top**, **nearest above pivot** just above the pivot row |
| **Pivot** | Center |
| **Below pivot** | Odd + even **merged** — **nearest below pivot** first, then progressively lower |

Odd-only or even-only uses the same nearest-from-pivot ordering; pivot stays centered.

| Item | Detail |
|------|--------|
| **Odd squares** | (√pivot ± 2n)² — OS↑/↓ |
| **Even squares** | (√pivot ± (2n±1))² — ES↑/↓ |
| **Bar 0 banner** | When `gannBar0.available` is false for all TFs |

Forming bar **open** is also published as `timeframes.{TF}.open`.

See also Analysis Lab Gann study (`gann.util.ts`) for swing-octave on historical grids.

### RSI zone highlights (colored box around value)

| RSI | Box color |
|-----|-----------|
| &lt; 40 | Red |
| 40 – 44.9 | Yellow |
| 45 – 55 | Neutral (no highlight) |
| 55.1 – 60 | Yellow |
| &gt; 60 | Green |

Text stays neutral; only the **rectangle background** changes.

### RSI source toggle (page only)

| Option | Data used |
|--------|-----------|
| **Calculated** | Python Wilder — `rsi` / `completed.rsi` in API |
| **MT5 built-in** | `mt5.shift0.rsi` / `mt5.shift1.rsi` from EA export |

Not saved to user preferences. If **MT5 built-in** is selected but `mt5ExportAvailable` is false, attach the EA (below).

## How to compare

1. MT5 chart: **XAUUSD**, same timeframe as the app row (e.g. M5).
2. RSI indicator: **Period 14**, **Applied to Close** (default).
3. Open **Data Window** (Ctrl+D) and hover candles:
   - **Bar index 0** (rightmost / forming) → app **Bar 0 · forming**
   - **Bar index 1** (previous closed) → app **Bar 1 · MT5 Data Window**

## OctaFX / Octa Markets timezone

`copy_rates` bar open times are **UTC**. The app converts to **broker server time (UTC+3)** for display. MT5 chart axis uses the same server time — bar labels should now line up.

Set consistently:

| Location | Setting |
|----------|---------|
| Python | `BROKER_SERVER_ZONE=Etc/GMT-3` |
| Backend | `grok.market.broker-server-zone=Etc/GMT-3` |
| Stack Pilot | `python-order-rsi.environment.BROKER_SERVER_ZONE` |

## Wilder RSI bug (fixed 2026-06-28)

Earlier builds computed Wilder RSI **one bar ahead** of MT5 `iRSI`. Symptom using your live snapshot:

| TF | Old app bar 0 | Old app bar 1 | **Correct bar 0** | **Correct bar 1** |
|----|---------------|---------------|-------------------|-------------------|
| M1 | 85.89 | 84.66 | **80.83** | **85.89** |
| M5 | 65.86 | 58.77 | **72.82** | **65.86** |
| H1 | 60.33 | 58.94 | **65.24** | **60.33** |

Old **bar 0** (85.89 on M1) equaled MT5 **bar 1**, not bar 0 — hence the mismatch when comparing the forming candle.

## Optional: MT5 built-in iRSI export

Python MetaTrader5 package has no `iRSI` API. The app reads MT5 terminal values via EA export.

**Full MQL5 guide (install, compile, both EAs):** [python/mt5_scripts/README.md](../python/mt5_scripts/README.md)

### Quick install (pre-built)

1. Copy `python/mt5_scripts/GrokDevOrderRsiExport.ex5` (+ `.mq5`) to your terminal `MQL5\Experts\` folder.
2. MT5 Navigator → **Refresh** → drag **GrokDevOrderRsiExport** onto **XAUUSD**.
3. Enable **Algo Trading**.
4. EA writes `Terminal/Common/Files/grok_dev_order_rsi_mt5.json` (atomic temp + move).
5. Publisher includes `timeframes.{TF}.mt5` in the API; use **MT5 built-in** toggle on the **Analyzer** page.

Source: `python/mt5_scripts/GrokDevOrderRsiExport.mq5` (**v2.0**). Pre-built: `GrokDevOrderRsiExport.ex5` in the same folder.

### EA v2.0 settings (recommended)

| Input | Default | Purpose |
|-------|---------|---------|
| `InpSymbol` | `XAUUSD` | Symbol (validated on attach) |
| `InpPeriod` | `14` | RSI period — must match chart iRSI |
| `InpTimerSec` | `2` | How often export is attempted |
| `InpNewBarOnly` | `false` | `true` = write only when M1 bar changes (less I/O; forming-bar RSI updates less often) |
| `InpEnableFileLog` | `false` | Log errors to `grok_dev_order_rsi_log.txt` in Common Files |

**For live Bar 0 RSI comparison:** keep `InpNewBarOnly = false` and `InpTimerSec = 2`–`5`.

**Power-saving mode:** `InpNewBarOnly = true` and raise Python staleness: `MT5_RSI_EXPORT_MAX_AGE=120`.

### v2.0 improvements

| Feature | Benefit |
|---------|---------|
| Atomic write (`.tmp` → `FileMove`) | Python never reads partial JSON |
| Symbol validation on `OnInit` | Clear error if symbol missing |
| Guaranteed `IndicatorRelease` | No iRSI handle leaks |
| Optional file log | Production debugging |
| `updatedAt` in **UTC** (`TimeGMT`) | Matches `mt5_rsi_export.py` freshness check |

Compare script:

```powershell
cd python
python scripts/compare_mt5_rsi.py
```

## Market closed (weekend)

Bars may be from **Friday** while `asOf` is **Sunday** — expected. RSI still uses the last MT5 bars; live bid updates the forming bar close only when the symbol tick moves.
