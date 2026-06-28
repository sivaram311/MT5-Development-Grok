# MT5 XAUUSD Data Downloader

Python module to download complete historical OHLC data for **XAUUSD** from MetaTrader 5 into PostgreSQL.

## Features
- Downloads all available candles for multiple timeframes
- Stores data in the same `grok_dev` schema used by the Spring Boot application
- Table naming: `XAUUSD_D1`, `XAUUSD_H4`, `XAUUSD_H1`, `XAUUSD_M15`, `XAUUSD_M5`, `XAUUSD_M1`
- **Live continuous sync mode** (`--daemon`): Automatically updates the database with **only completed candles** as they form
- Smart incremental updates (upsert on `time`)
- Auto table creation
- Batch fetching + auto-detection of MT5 terminal

## Timeframes Supported
| Key | Timeframe |
|-----|-----------|
| D1  | Daily     |
| H4  | 4 Hours   |
| H1  | 1 Hour    |
| M15 | 15 Minutes|
| M5  | 5 Minutes |
| M1  | 1 Minute  |

## Setup

1. Install dependencies:
```bash
cd E:\Source\grok_dev\python
pip install -r requirements.txt
```

2. Make sure MT5 terminal is running and logged in.

3. (Optional) Create `.env` file for database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres
```

## Run

From the `python` directory:

```powershell
cd E:\Source\grok_dev\python

# One-time historical + catch-up (recommended first run)
python -m mt5_xauusd.main

# Continuous sync: per-TF smart intervals (M1:15s … D1:1800s) — default when --poll-seconds omitted
python -m mt5_xauusd.main --daemon

# Force uniform interval for all timeframes (optional override)
python -m mt5_xauusd.main --daemon --poll-seconds 45

# Using the convenience wrapper (same defaults)
python run_data_downloader.py
```

Run `python -m mt5_xauusd.main --help` for all options.

### Continuous / Live Sync Logic (Recommended)

**Goal**: Automatically keep the database updated with **only completed candles** as soon as a new one forms.

#### Core Rule We Follow
MT5 always returns the **currently forming candle as the last bar**.

We therefore always drop the last bar before saving anything:

```python
df = df.iloc[:-1]                    # remove the incomplete candle
df = df[df['time'] > last_db_time]   # only new completed candles
```

This is implemented in `fetch_recent_completed_rates()`.

#### How the Daemon Works (smart per-TF)
1. Query latest per TF from DB.
2. Fetch recent completed bars from MT5 (drop last forming bar).
3. Upsert newer bars only + update sync_status.
4. Smart schedule loop (5s check) using per-TF intervals from config (M1 every 15s, M5 30s, M15 60s, H1 3m, H4 10m, D1 30m).
5. Auto-reconnect + file logging.
6. Repeat.

This guarantees `grok_dev.XAUUSD_*` contain **only completed** candles.

#### Recommended Way to Run (Production)
```powershell
# Smart per-TF default (recommended for efficiency)
python run_data_downloader.py

# or
python -m mt5_xauusd.main --daemon

# Force uniform 45s for all TFs
python run_data_downloader.py --daemon --poll-seconds 45
```

Run 24/7 via Windows Task Scheduler (see below).

See the "Recommendations & Best Practices" section.

### Troubleshooting

**ModuleNotFoundError: No module named 'config'**

- Run from the `python` directory.
- Use `python -m mt5_xauusd.main` or `python run_data_downloader.py`.
- Do not cd into `mt5_xauusd` and run `main.py` directly.

**MT5 terminal not found**

The script defaults to auto-detecting `terminal64.exe` in common locations (C:\Program Files\..., E:\..., etc.).

If it can't find it:
1. Find your `terminal64.exe` (usually in `MetaTrader 5` or `MT5` folder).
2. In `config.py`, set:
   ```python
   MT5_PATH = r"full\path\to\terminal64.exe"
   ```

**Must do before running:**
- Launch MT5 terminal and log in.
- In MT5: Tools > Options > Expert Advisors → enable "Allow DLL imports".

The error message now lists searched paths to help you.

## Recommendations & Best Practices

Here are my current recommendations for the live sync:

### 1. Running Mode (Strongly Recommended)
- Use the **daemon mode** for production:
  ```powershell
  python run_data_downloader.py
  ```
  (defaults to all timeframes, **smart per-TF intervals**, only completed candles)

- Run it **24/7** using Windows Task Scheduler ("Run whether user is logged on or not").

### 2. Polling Interval (Smart per-timeframe)
The code now uses **per-timeframe intervals** by default (from config):

- M1: 15s
- M5: 30s
- M15: 60s
- H1: 3 minutes
- H4: 10 minutes
- D1: 30 minutes

This is much more efficient than polling everything every 45s.

You can still override with a single value using `--poll-seconds`.

### 3. Smarter Polling
We now use per-timeframe intervals by default (see above). This was implemented as recommended.

You can still force uniform polling if desired.

### MT5 incremental fetch

- **Do not** use `copy_rates_from(..., count=100000)` — returns empty on some terminals.
- Incremental catch-up uses **`copy_rates_range(from, now)`**; recent tail uses `copy_rates_from_pos` with count ≤ **10000**.

### 4. Monitoring & Observability (Implemented)
- `sync_status` table with last_candle_time per timeframe.
- Spring Boot: `GET /api/market/xauusd/sync-status` and `GET /api/market/xauusd/health`
- Health returns "UP" or "DEGRADED" + per-TF details.
- Dedicated **Health Dashboard** in Angular dashboard with color-coded cards per timeframe, freshness, and age.
- **SSE push:** `GET /api/market/xauusd/health/stream` (dashboard banner on DEGRADED/DOWN)
- **`touch_sync_status`** — daemon liveness: updates `last_synced`; if candle rows exist, also sets `last_candle_time` from `MAX(time)` in the table
- **`backfill_sync_status`** — called on daemon/one-shot startup to seed `sync_status` from existing tables

### Tests

```powershell
cd python
pip install -r requirements.txt
pytest tests/ -q
```

Run the health check:
```powershell
# From Spring Boot
curl http://localhost:8081/api/market/xauusd/health
```

### 5. Robustness (Implemented)
- Automatic reconnection logic (`ensure_connected` with exponential backoff).
- The daemon recovers from temporary MT5 disconnects.

### 6. Running 24/7 with Windows Task Scheduler (Recommended)

We provide a helper script:

```powershell
# Run as Administrator
cd E:\Source\grok_dev\python
.\setup_task_scheduler.ps1
```

This creates a task named `GrokDev-MT5-XAUUSD-Sync` that:
- Starts on computer boot
- Runs whether user is logged on or not
- Runs hidden
- Uses the recommended defaults

You can also create it manually (see the script for details).

**Tip**: Also set up MT5 to auto-start on login.

### 7. Integration with the Rest of the App (Implemented)
- Spring Boot exposes `/api/market/xauusd/sync-status` and `/api/market/xauusd/health`
- Angular market data section shows last update time for the selected timeframe.

---

## Database Schema

All tables live under the `grok_dev` schema (shared with Spring Boot).

Example table structure:
- `time` (PK, timestamp)
- `open`, `high`, `low`, `close`
- `tick_volume`, `spread`, `real_volume`

## Integration

Since data is stored in the same Postgres database and schema used by `grok_dev` Spring Boot application, you can:

- Create JPA entities in Spring Boot for these tables
- Query them directly from repositories
- Expose REST endpoints for the Angular frontend (charts, analysis, etc.)

## Notes

- First run may take time depending on how much history your broker provides.
- Tables (`XAUUSD_D1` etc.) are **automatically created** on first run for each timeframe (using `extend_existing=True` to avoid SQLAlchemy redefinition errors).
- MT5 must be running with the correct account logged in.
- MT5 path is auto-detected or configured in `config.py`.
- Subsequent runs are fast (incremental only).

See root CHANGELOG.md for full application change log (updated on every modification).
