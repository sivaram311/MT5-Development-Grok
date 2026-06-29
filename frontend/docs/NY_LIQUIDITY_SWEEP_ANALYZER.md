# NY Liquidity Sweep Analyzer

**Route:** `/dashboard/ny-liquidity-sweep`  
**API base:** `/api/market/xauusd/ny-liquidity-sweep`

Detects XAUUSD reversal setups during the New York session:

1. **Liquidity sweep** — price breaks PDL, Asian range, or running session extreme
2. **Structure return** — price returns within tolerance of a prior swing
3. **Multi-TF RSI** — H1 + M15 confluence
4. **Reversal** — displacement / close confirmation

---

## Architecture

| Layer | Files |
|-------|-------|
| Python engine | `python/mt5_xauusd/liquidity_sweep_analyzer.py` |
| Python publisher | `python/mt5_xauusd/liquidity_sweep_service.py`, `python/run_ny_liquidity_sweep.py` |
| Database | `grok_dev.liquidity_setups`, `grok_dev.live_ny_liquidity_sweep` |
| Spring Boot | `NyLiquiditySweepService`, `NyLiquiditySweepCalculator`, `NyLiquiditySweepController` |
| SSE | `NyLiquiditySweepStreamScheduler` (event: `nyLiquiditySweep`) |
| Angular | `ny-liquidity-sweep.component.ts`, `NyLiquiditySweepStreamService` |

---

## Run commands

```bash
# Historical backfill (Postgres M5/M15/H1/D1 required)
cd python
python run_ny_liquidity_sweep.py --backfill --days 30

# Live publisher (upserts live snapshot + saves setups)
python run_ny_liquidity_sweep.py --live
```

Or use **Scan history** in the UI / `POST /api/market/xauusd/ny-liquidity-sweep/scan?days=30` (Java grid scan).

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ny-liquidity-sweep` | Live snapshot |
| GET | `/ny-liquidity-sweep/stream` | SSE stream |
| GET | `/ny-liquidity-sweep/setups` | Historical grid (filters: from, to, direction, result) |
| GET | `/ny-liquidity-sweep/stats` | Win rate, avg R:R |
| GET | `/ny-liquidity-sweep/chart/{setupId}` | Chart candles + levels |
| POST | `/ny-liquidity-sweep/scan?days=30` | Grid backfill |

---

## UI features

- Performance stats (total, win rate, avg R:R)
- Live multi-TF RSI panel when setup is active
- **Interactive chart** — click any historical row to replay the setup on M5:
  - **Candles** — OHLC candlesticks via `chartjs-chart-financial` (default)
  - **Line** — close-price line (previous view)
  - Toggle with **Candles | Line** in the chart header; preference saved in `localStorage` (`nyLiquidityChartMode`)
  - Overlays: sweep / structure / entry / SL / TP1 / TP2 level lines
  - Markers: sweep (triangle) and structure (circle) at `sweepTime` / `structureTime`
- Historical setups table with filters and CSV export
- Dashboard alert banner on live setups (SSE)

---

## Configurable parameters (Python)

See `LiquiditySweepConfig` in `liquidity_sweep_analyzer.py`:

- NY session: 08:00–17:00 NY
- Sweep buffer: 3 pips (0.30 on XAUUSD)
- Structure tolerance: 6 pips
- Max wait after sweep: 90 minutes
- RSI H1 floor: 38, M15 entry zone: 35

---

## Telegram alerts

Not wired in this release — browser banner via `LiquidityAlertBannerComponent` + SSE. Telegram can be added to the Python publisher using the same hook pattern as future integrations.
