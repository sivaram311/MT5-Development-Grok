# Python MT5 Data Downloader — Deep Dive

The Python data acquisition pipeline is located in [mt5_xauusd](file:///E:/Source/grok_dev/python/mt5_xauusd/).

## Purpose
It is the only component in the platform that communicates directly with the MetaTrader 5 (MT5) terminal. Its primary responsibility is to fetch completed XAUUSD candle records and upsert them into the database so the rest of the application has access to clean, stable historical data.

## Core Files

- **[main.py](file:///E:/Source/grok_dev/python/mt5_xauusd/main.py)**: The command line interface (CLI) entry point.
- **[config.py](file:///E:/Source/grok_dev/python/mt5_xauusd/config.py)**: Contains database credentials, target symbols, historical backfill depth parameters, and timeframe intervals.
- **[mt5_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py)**: Low-level wrapper around the official `MetaTrader5` package. Handles terminal initialization, connection checks, and rate-copying commands.
- **[postgres_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py)**: SQLAlchemy client that manages schema verification, dynamic creation of the timeframe tables, upserts, and sync log status updates.
- **[data_downloader.py](file:///E:/Source/grok_dev/python/mt5_xauusd/data_downloader.py)**: Coordinates downloader tasks, providing both catch-up (one-shot backfill) and daemon (polling sync loop) modes.

---

## Critical Design Decisions

### 1. Only Completed Candles
```python
if len(df) > 1:
    df = df.iloc[:-1]   # Drop the bar that is still forming
```
This is implemented in the `fetch_recent_completed_rates()` method of [mt5_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py). Dropping the final forming candle ensures that the database only holds finalized candle bars, avoiding the need for updates or data changes.

### 2. Incremental & Idempotent Upserts
To minimize bandwidth and processor overhead:
- The script checks the database via `get_last_timestamp()` in [postgres_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py) to find the newest stored candle.
- It queries the terminal for data starting from that timestamp.
- It filters the dataframe to include rows strictly newer than the database's latest timestamp (`df = df[df['time'] > last_ts]`).
- It applies an `ON CONFLICT DO NOTHING` constraint on the `time` primary key during insertion, making the operation idempotent and safe to restart at any time.

### 3. Smart Per-Timeframe Polling Intervals (Daemon Mode)
In continuous execution mode, rather than polling all timeframes uniformly, the script applies smart intervals configured in [config.py](file:///E:/Source/grok_dev/python/mt5_xauusd/config.py):

```python
TIMEFRAME_POLL_INTERVALS = {
    "M1": 15,     # Poll every 15 seconds
    "M5": 30,     # Poll every 30 seconds
    "M15": 60,    # Poll every 60 seconds
    "H1": 180,    # Poll every 3 minutes
    "H4": 600,    # Poll every 10 minutes
    "D1": 1800,   # Poll every 30 minutes
}
```
This optimizes network and database usage, as slower timeframes do not need frequent checks.

### 4. Direct Database Writes
By writing directly to PostgreSQL and avoiding intermediate REST APIs, the ingestion pipeline:
- Remains completely independent of the Spring Boot application lifecycle.
- Can run persistently on a Windows Task Scheduler script on startup.
- Minimizes overhead during high-frequency historical backfills.

---

## How It Updates Ingestion Health

After writing a successful batch of records, [data_downloader.py](file:///E:/Source/grok_dev/python/mt5_xauusd/data_downloader.py) calls:
```python
self.pg_client.update_sync_status(tf_key, latest_time)
```
This logs the database write time and the last candle timestamp into the `sync_status` table, which is read by [health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts) to display freshness indicators.

## Running the Downloader

### 1. Catch-Up Mode (One-Shot)
Performs a one-off incremental sync to catch up on missed candles:
```bash
python -m mt5_xauusd.main
```

### 2. Daemon Mode (Continuous Polling)
Runs the continuous polling sync loop using the intervals defined in `config.py`:
```bash
python run_data_downloader.py --daemon
```

## System Requirements

- A MetaTrader 5 terminal must be **running and logged in** on the host.
- The symbol `XAUUSD` must be visible in the Market Watch window.
- Make sure "Allow DLL imports" is enabled in MT5 options.

## Logging & Auditing

All daemon operations are logged to the file `python/logs/xauusd_sync.log` with automatic log rotation.