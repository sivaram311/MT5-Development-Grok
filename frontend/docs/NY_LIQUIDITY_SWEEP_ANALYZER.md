# NY Liquidity Sweep Analyzer

**Route:** `/dashboard/ny-liquidity-sweep`  
**API base:** `/api/market/xauusd/ny-liquidity-sweep`

Detects XAUUSD reversal setups during the New York session:

1. **Liquidity sweep** — price breaks PDL, Asian range, or running session extreme
2. **Structure return** — price returns within tolerance of a prior swing
3. **Multi-TF RSI** — configurable higher TF + lower TF confluence
4. **Reversal** — displacement / close confirmation

---

## Timeframe combinations

| Preset | HTF (RSI) | LTF (RSI) | Entry TF |
|--------|-----------|-----------|----------|
| H1 → M15 (M15 entry) | H1 | M15 | M15 |
| H1 → M1 (M1 entry) | H1 | M1 | M1 |
| M15 → M1 (M1 entry) | M15 | M1 | M1 |
| H4 → M15 (M15 entry) | H4 | M15 | M15 |
| H4 → M1 (M1 entry) | H4 | M1 | M1 |

**Rules:** HTF must be higher than LTF; entry is **M15** or **M1** only.

---

## Architecture

| Layer | Files |
|-------|-------|
| Python engine | `python/mt5_xauusd/liquidity_sweep_analyzer.py` |
| TF helpers | `python/mt5_xauusd/liquidity_tf_util.py` |
| Python publisher | `python/mt5_xauusd/liquidity_sweep_service.py`, `python/run_ny_liquidity_sweep.py` |
| Database | `grok_dev.liquidity_setups`, `grok_dev.live_ny_liquidity_sweep` |
| Spring Boot | `NyLiquiditySweepService`, `NyLiquiditySweepCalculator`, `NyLiquiditySweepController` |
| SSE | `NyLiquiditySweepStreamScheduler` (event: `nyLiquiditySweep`) |
| Angular | `ny-liquidity-sweep.component.ts`, `NyLiquiditySweepStreamService` |

---

## Run commands

```bash
# Historical backfill — M15 entry, H1/M15 RSI (default)
cd python
python run_ny_liquidity_sweep.py --backfill --days 30

# M1 entry with H1/M1 RSI
python run_ny_liquidity_sweep.py --backfill --days 30 --entry-tf M1 --htf H1 --ltf M1

# H4 → M15 preset
python run_ny_liquidity_sweep.py --backfill --days 30 --entry-tf M15 --htf H4 --ltf M15

# Live publisher
python run_ny_liquidity_sweep.py --live --entry-tf M15 --htf H1 --ltf M15
```

Or use **Scan history** in the UI with the TF preset dropdown / custom HTF·LTF·Entry selectors.

`POST /api/market/xauusd/ny-liquidity-sweep/scan?days=30&entryTf=M15&htf=H1&ltf=M15`

**Backfill** clears existing rows for the same TF combo before writing (matches UI scan). Switching presets reloads both the history table and stats for that combo.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ny-liquidity-sweep` | Live snapshot |
| GET | `/ny-liquidity-sweep/stream` | SSE stream |
| GET | `/ny-liquidity-sweep/presets` | TF preset list |
| GET | `/ny-liquidity-sweep/setups` | Historical grid (`from`, `to`, `direction`, `result`, `entryTf`, `htf`, `ltf`) |
| GET | `/ny-liquidity-sweep/stats` | Win rate, avg R:R (same TF filters as setups) |
| GET | `/ny-liquidity-sweep/chart/{setupId}` | Chart candles (setup's entry TF) + levels |
| POST | `/ny-liquidity-sweep/scan` | Grid backfill (`days`, `entryTf`, `htf`, `ltf`) |

---

## UI features

- **TF preset dropdown** — quick-select common HTF/LTF/entry combinations
- **Custom TF row** — HTF → LTF + entry TF selectors (synced with presets)
- Performance stats (total, win rate, avg R:R)
- Live multi-TF RSI panel when setup is active (labels match selected HTF/LTF)
- **Interactive chart** — click any historical row to replay the setup on the setup's **entry timeframe**:
  - **Candles** — OHLC candlesticks via `chartjs-chart-financial` (default)
  - **Line** — close-price line (previous view)
  - Toggle with **Candles | Line** in the chart header; preference saved in `localStorage` (`nyLiquidityChartMode`)
  - Focused window: **12 bars** before sweep/structure, **6 bars** after first SL/TP (or 12 if still open)
  - **Horizontal lines** (price levels) — see legend under chart:
    | Line | Style | Meaning |
    |------|-------|---------|
    | Amber solid | Sweep level |
    | Gray solid | Structure reference |
    | Green solid | Entry price |
    | Red dashed | Stop loss |
    | Light green dashed | TP1 / TP2 |
  - **Event bar highlights** (Candles mode) — tinted zones above high and below low on key bars (no vertical lines):
    | Bar | Above high | Below low |
    |-----|------------|-----------|
    | Liquidity sweep | Orange | Sky |
    | Entry trigger | Sky | Violet |
    | Exit (SL or TP) | Rose | Violet |
  - Liquidity bar from `sweepTime` or price match to `sweep_level` before entry
  - Candles: **blue** up / **pink** down bodies

---

## Setup ID format

`XAU_{date}_{nyTime}_{B|B}_{entryTf}` — e.g. `XAU_2026-06-26_1030_B_M15`

Payload includes `entryTf`, `htf`, `ltf`, `sweepTime`, `structureTime`.
