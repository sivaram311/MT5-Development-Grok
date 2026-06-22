# Changelog

All notable changes to the Grok Dev full-stack application (Spring Boot + Angular + Python MT5 data pipeline) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-06-23

### UI/UX Redesign & Iteration (Senior Modern Dashboard)
- Full page redefinition with professional trading UI:
  - Dark zinc palette, clean typography, sidebar navigation (collapsible on desktop).
  - Distinct sections acting as pages: Overview, Market Data, Health, **Analysis**.
  - Improved column customization as **slide-over drawer** (better mobile UX).
  - Added **Analysis** page with placeholders for Gann, RSI Storm, Backtesting.
- Iterations:
  - Better KPI bar, empty states, section polish.
  - Sidebar + top nav for modern dashboard feel.
  - Preserved and enhanced all features (timezones, visibility, per-TF, exports, health).
- Login: Premium dark form.
- **Routed Pages**: Introduced proper DashboardLayout with child routes for Overview, Market, Health, Analysis for better architecture and scalability.
- **Data Grid Fix**: Market Data page now properly fetches real data from backend (`/market/xauusd/{tf}/grid?limit=500`) instead of hardcoded 3 rows. Supports timeframe switching and basic column visibility via drawer. Shows full available rows (hundreds if downloader ran).
- **NY Session Filter**: Added "NY Session Only" toggle (next to timeframe selector in Market Data). When enabled:
  - Only NY session bars (common 08:00-17:00 NY time) are fetched for the grid.
  - Non-NY periods are omitted (not shown as gaps in the table).
  - For D1: OHLC is computed only from NY session bars of the day.
  - RSI is calculated only on the filtered NY-session data.
  - Affects only the Data Grid tab (existing full data behavior preserved when off).
  - Not persisted (manual toggle).
- Overall: Scalable, delightful, trader-focused experience.

### Added
- Analysis section.
- Slide-over column drawer.
- Collapsible sidebar.
- Proper child routed pages with layout component.
- Real data fetching in Market page with large limit.
- NY session only filter for data grid.

### Added
- **Data Grid timezone columns** (Broker / New York / IST):
  - Backend: `XauusdCandle` now carries `nyTime` + `istTime` (converted in `getXauusdGridData` using UTC→target zones).
  - UI: Data Grid tab renders three time columns (BROKER | NY | IST) with the existing OHLC + RSI.
  - Fallback data also provides demo values.
- **Data Grid column visibility** (enhanced):
  - Full per-column show/hide toggles (Broker, NY, IST, O, H, L, C, RSI).
  - "Times" group toggle, Show all, Hide all, Reset.
  - Preferences saved in localStorage.
  - Dynamic colspan. 
- **Overview recent candles visibility**:
  - Same show/hide functionality added for the Overview table and mobile cards (Time, O, H, L, C, Vol).
  - Compact controls + All/None buttons.
  - Responsive grid layout adjusts automatically.
  - All visibility is persistent across reloads and views.
- **Column visibility enhancements** (completed all recs):
  - Drag & drop reordering on pills (HTML5 native) + arrows.
  - Copy visible to clipboard (TSV) next to CSV exports.
  - Presets as mobile-friendly chips.
  - Backend-persisted preferences via /api/auth/preferences (per-user, includes grid/ov/health per TF).
  - Health dashboard now supports per-TF card visibility toggles.
  - Full sync between local and backend on load/save.
- **Dedicated Health Dashboard polish** (backend + Angular):
  - Backend `getMarketDataHealth()` now computes real per-TF freshness using production thresholds (M1 <2m, M5<7m, ..., D1<25h).
  - Richer response includes `freshCount`, `total`, per-TF `fresh` flag + `lastSynced`.
  - Enhanced Angular health cards + summary header ("X/6 fresh"), prefers backend `fresh` flag.
  - Improved overall status (UP / DEGRADED / DOWN).
- **Improved Task Scheduler helper** (`python/setup_task_scheduler.ps1`):
  - Auto-detects python.exe / py.exe across common locations.
  - Triggers on startup + logon.
  - Robust restart policy + better UX + clear admin guidance.
- **Smart per-TF polling as default** for continuous daemon:
  - `run_data_downloader.py` now defaults to `--daemon` (uses `TIMEFRAME_POLL_INTERVALS`).
  - Uniform `--poll-seconds` override remains available (e.g. for 45s all TFs).
- File logging (rotating) and `ensure_connected` reconnection already active in daemon loop.

- **MT5 Market Data Pipeline (Python)**: `python/mt5_xauusd/` module for XAUUSD OHLC (D1/H4/H1/M15/M5/M1) into grok_dev schema.
  - Always drop forming bar (`iloc[:-1]`) for completed candles only.
  - Per-TF smart intervals + smart scheduler loop, sync_status table, auto tables, reconnection, file logs.
- **Spring Boot**:
  - `MarketDataService` + `MarketDataController`: `/xauusd/{tf}`, `/grid` (with server RSI), `/sync-status`, `/health`.
  - DESC ordering + RSI calc (Wilder) for recent grid data.
- **Angular**:
  - Full responsive market UI (pills, hero price + %, Chart.js, segmented Overview/Grid tabs).
  - Mobile-first (Realme phone/tablet), bottom nav, dark mode, fallback data, health dashboard.
- **Docs & Changelog**: Full updates on every change (this file + setup, architecture, api, python READMEs, etc.).

### Changed
- Python daemon default now prefers smart per-TF intervals (M1:15s ... D1:30m) over fixed 45s.
- `getSyncStatus()` now returns richer map (includes lastSynced).
- Health dashboard UI updated to surface backend freshness + summary count.
- Task scheduler script significantly hardened (detection + multiple triggers).
- `run_data_downloader.py` default changed to smart intervals.

### Fixed
- Duplicate `import java.util.Map` in MarketDataController.
- Backend health was naive (always fresh if data present); now threshold-based.
- Default runner was forcing uniform 45s (now smart by default).

### Notes
- **UI/UX**: Mobile/tablet first, trader perspective (big price, fast TF switch, color freshness, RSI in grid).
- Data flow: MT5 (daemon) → completed candles only → Postgres grok_dev.XAUUSD_* + sync_status → Spring / Angular.
- To run live: `cd python; python run_data_downloader.py` (or Task Scheduler).
- For uniform poll: `python run_data_downloader.py --daemon --poll-seconds 45`.
- See `python/mt5_xauusd/README.md` and `docs/setup-and-run.md`.

## [Previous] - Pre-Market Data (Auth + Basic UI)
- Initial JWT + refresh token auth system (Spring Security stateless, Angular interceptors/guards).
- DataSeeder for admin/admin123 with runtime BCrypt.
- Responsive login/welcome with live token countdown, projects grid, role-based admin panel.
- run-dev.ps1 launcher.
- Full docs for setup, architecture (SOLID, patterns), API, security.
- Unit tests.
- Port handling (8081), circular dependency fixes, etc.

See git history for earlier commits.