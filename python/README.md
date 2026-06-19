# Python Scripts - MT5 Data Layer

This folder contains Python components for the Grok Dev project, primarily focused on ingesting market data from MetaTrader 5 into PostgreSQL.

## Current Module

**mt5_xauusd** - Downloads historical XAUUSD data across multiple timeframes into the `grok_dev` schema.

### Quick Start

```powershell
cd E:\Source\grok_dev\python
pip install -r requirements.txt

# Run the downloader
python -m mt5_xauusd.main
# or
python run_data_downloader.py

# With options (e.g. specific timeframes)
python -m mt5_xauusd.main --timeframes D1 H4
```

**Important:** 
- Start and log into MT5 terminal **first**.
- The script auto-detects common installation paths for `terminal64.exe`. Update `config.py` if needed.

See `mt5_xauusd/README.md` for detailed documentation, including troubleshooting.

## Goals

- Reliable data pipeline from MT5 → Postgres
- Share the same database/schema as the Spring Boot backend
- Enable rich analysis in the Angular frontend (Gann, multi-timeframe, etc.)
- Well-structured, maintainable code

See root CHANGELOG.md (at grok_dev level) for complete logs of all changes across backend, frontend, Python, and docs.

## Future Enhancements (Recommended)

- Scheduled runs (Windows Task Scheduler)
- Data validation & gap filling
- Support for more symbols
- API endpoint in Spring Boot to trigger refresh
- Tick data support (separate tables)
- Dockerization of the Python service
