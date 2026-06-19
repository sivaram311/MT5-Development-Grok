# Changelog

All notable changes to the Grok Dev full-stack application (Spring Boot + Angular + Python MT5 data pipeline) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-06-19

### Added
- **MT5 Market Data Pipeline (Python)**: New `python/mt5_xauusd/` module to connect to MetaTrader 5, download XAUUSD OHLC + time data for D1, H4, H1, M15, M5, M1 timeframes.
  - Stores data in shared `grok_dev` Postgres schema with tables `XAUUSD_D1`, `XAUUSD_H4`, etc.
  - Features: Auto-detection of MT5 `terminal64.exe`, incremental updates (only new bars after first full load), batch fetching for large histories, auto table creation on first run, CLI arguments (`--timeframes`, `--no-incremental`).
  - Convenience script `run_data_downloader.py`.
  - Robust error handling, logging, and first-run full historical download support.
- **Spring Boot Market Data Integration**:
  - New `MarketDataService` using `JdbcTemplate` for dynamic timeframe queries.
  - New `MarketDataController` with endpoints:
    - `GET /api/market/xauusd/{timeframe}?from=...&to=...&limit=...`
    - `GET /api/market/xauusd/{timeframe}/latest?limit=...`
  - New DTO `XauusdCandle` (in `model/market/`).
- **Angular Frontend UI/UX Enhancements** (Senior UI/UX focus on mobile & tablet):
  - Enriched XAUUSD Market Data section in `WelcomeComponent`.
  - Timeframe selector pills (horizontal scroll for mobile thumb access).
  - Large hero price card with % change (color-coded green/red).
  - Interactive Chart.js line chart for close prices.
  - Responsive data view: Full table on desktop/tablet, stacked cards on mobile (Realme P2 Pro / Pad 2 optimized).
  - Quick presets (1D, 1W, 1M, All), refresh button, limit control.
  - Fallback demo data when backend unavailable.
  - Added `chart.js` and `date-fns` dependencies.
  - Strict mobile-first: Large tap targets, adaptive layouts, minimal scrolling.
- **Documentation Updates**:
  - Comprehensive CHANGELOG.md at root.
  - Enhanced `README.md`, `docs/setup-and-run.md`, `docs/architecture.md`, `docs/api-endpoints.md`, `docs/database-schema.md`, `docs/frontend-guidelines.md`.
  - Python module READMEs and INTEGRATION.md with troubleshooting (MT5 init, imports, first-run table creation).
- New Python files for better UX: `run_data_downloader.py`, improved CLI in `main.py`, auto MT5 path detection in `config.py` / `mt5_client.py`.
- SQLAlchemy fix: `extend_existing=True` for table re-registration to prevent "already defined" errors on first runs.

### Changed
- Python package now uses relative imports (`from .config import ...`) for proper `python -m mt5_xauusd.main` execution.
- `postgres_client.py`: Safe `get_last_timestamp` handling and upfront table creation in downloader.
- Frontend `welcome.component.ts`: Major UI additions for market data + Chart.js integration; fixed TS issues (TooltipItem, missing fallback method).
- Package updates: Frontend `package.json` includes chart.js and date-fns.
- Backend now scans and serves market data alongside existing auth/projects features.

### Fixed
- Import errors (`No module named 'config'`) via relative imports and convenience runner.
- MT5 path detection and initialization (better error messages, auto-detect).
- Database table creation race conditions on first data pull.
- TypeScript compilation errors for chart tooltips and missing methods after npm install.
- Various path/quoting issues in Windows PowerShell runs.

### Notes
- UI/UX Principle: All frontend changes prioritize Realme P2 Pro (mobile) and Realme Pad 2 (tablet) responsiveness, ease of access (thumb-friendly controls, instant insights), and trader perspective (quick price view, direction cues, recent candles).
- Data flows: MT5 → Python (incremental/batched) → Postgres (grok_dev) → Spring Boot (JdbcTemplate) → Angular (responsive UI + charts).
- Requires: MT5 running + logged in before Python downloader; Postgres schema `grok_dev`; npm install in frontend for charts.
- Future: Angular candlestick enhancements, Gann analysis integration, scheduled Python runs, more symbols.

## [Previous] - Pre-Market Data (Auth + Basic UI)
- Initial JWT + refresh token auth system (Spring Security stateless, Angular interceptors/guards).
- DataSeeder for admin/admin123 with runtime BCrypt.
- Responsive login/welcome with live token countdown, projects grid, role-based admin panel.
- run-dev.ps1 launcher.
- Full docs for setup, architecture (SOLID, patterns), API, security.
- Unit tests.
- Port handling (8081), circular dependency fixes, etc.

See git history for earlier commits.