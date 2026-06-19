# MT5 XAUUSD Data Downloader

Python module to download complete historical OHLC data for **XAUUSD** from MetaTrader 5 into PostgreSQL.

## Features
- Downloads all available candles for multiple timeframes
- Stores data in the same `grok_dev` schema used by the Spring Boot application
- Table naming: `XAUUSD_D1`, `XAUUSD_H4`, `XAUUSD_H1`, `XAUUSD_M15`, `XAUUSD_M5`, `XAUUSD_M1`
- Incremental updates using upsert (ON CONFLICT DO NOTHING)
- Batch fetching to handle large historical data
- Clean separation: MT5 client + Postgres client

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

# Recommended:
python -m mt5_xauusd.main

# Or using the convenience script:
python run_data_downloader.py

# Specific timeframes only:
python -m mt5_xauusd.main --timeframes D1 H4

# Force complete re-download:
python -m mt5_xauusd.main --no-incremental
```

Run `python -m mt5_xauusd.main --help` for all options.

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
