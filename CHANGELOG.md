# Changelog

All notable changes to the Grok Dev full-stack application (Spring Boot + Angular + Python MT5 data pipeline) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-06-29 (Gann Intraday usage guide)

### Documentation
- **Gann Intraday usage guide** — [frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md](frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md): page tutorial, controls, confluence scoring, step-by-step workflows, troubleshooting
- In-app Docs accordion expanded; page header link renamed to **Usage guide**; README, `ANGULAR_FRONTEND.md`, implementation tracker updated

---

## [Unreleased] - 2026-06-28 (Gann Intraday phase 2 — API, SSE, filters)

### Added
- **REST API** `GET /api/market/xauusd/gann-intraday` — server-side study (Java calculator + grid fallback)
- **SSE** `/gann-intraday/stream` — live push from `live_gann_intraday` table
- **Python publisher** `run_gann_intraday.py` + `gann_intraday_util.py`
- **London session** pivots & killzone; **IST window** labels on killzones
- **1×1 fan lines** (1×1 / 2×1 / 1×2) on page + API
- **Configurable** time scale & ATR alert threshold
- **Volume spike** & **RSI divergence** filters in confluence scoring
- **Gann alert banner** on dashboard (high/medium reversal)
- **MQL5** `GrokDevGannScanner.mq5` — exports scanner JSON to Common Files

---

## [Unreleased] - 2026-06-28 (Gann Intraday page)

### Added
- **Gann Intraday** page (`/dashboard/gann-intraday`) — all five intraday Gann modules (V1 frontend):
  - 1×1 Gann angle equilibrium & overextension bias
  - Session pivots (PDH/PDL, NY open/H/L)
  - Fine So9 steps (0.25 / 0.5 / 1.0) + odd/even diagonals
  - Time squaring (45/90/180 min milestones)
  - NY killzones + reversal confluence alert
- Utils: `gann-session-pivot`, `gann-angle`, `gann-so9-fine`, `gann-so9-odd-even`, `gann-time-square`, `gann-killzone`, `gann-intraday`
- Tracker doc: [docs/gann-intraday-pending-implementation.md](docs/gann-intraday-pending-implementation.md)

---

## [Unreleased] - 2026-06-28 (Gann merged row order)

### Changed
- **Gann grids** — odd/even bands merged above/below pivot; pivot centered; one row per level sorted by distance from pivot (`gann-grid-rows.util.ts`).

---

## [Unreleased] - 2026-06-28 (Gann dual grids Bar 0 / Bar 1)

### Added
- **Gann Bar 0 Open** grid — separate table, pivot from forming bar **open**; unavailable banner when missing.
- **Gann Bar 1 Close** grid — renamed from single `gann`; own Odd/Even toggles.
- **Shared Pivot row** when Odd or Even is on (fixes pivot hidden on Even-only).

### Changed
- API: `gann` → `gannBar1` + `gannBar0`; `timeframes.{TF}.open` published.

---

## [Unreleased] - 2026-06-28 (Analyzer Gann Odd Square)

### Added
- **Gann Odd Square** block on Analyzer — live So9 odd/even square levels per TF (Bar 1 close pivot).
- **`gann_odd_square_util.py`** + pytest; `timeframes.{TF}.gann` in Order RSI snapshot.

### Documentation
- Alignment guide, API docs, README, in-app Docs, `ANGULAR_FRONTEND.md`.

---

## [Unreleased] - 2026-06-28 (Analyzer S/R label fix)

### Fixed
- **Classic pivot S/R names** — `pivot_util.py` maps `sr.s3`/`sr.r3` (and S2/R2, S1/R1) to match UI / MT5 row labels (were inverted).

### Documentation
- Alignment guide formula table, `ANGULAR_FRONTEND.md`, API example JSON updated.

---

## [Unreleased] - 2026-06-28 (Analyzer classic S/R pivots)

### Added
- **Classic floor pivots** in Order RSI publisher — `sr` (Bar 0) and `completed.sr` (Bar 1) per timeframe.
- **Analyzer UI** — **B0SR** / **B1SR** row groups (S3–R3), toggled together via Show rows chips.
- **`pivot_util.py`** + pytest coverage.

### Documentation
- Alignment guide, API docs, README, in-app Docs updated for S/R rows.

---

## [Unreleased] - 2026-06-28 (Analyzer + MT5 RSI alignment)

### Added
- **Analyzer** page (nav label; route `/dashboard/order-rsi`) — TF-column table, four toggleable rows (Bar 0/1 RSI + data).
- **RSI zone highlights** — colored box around RSI (red / yellow / neutral / green).
- **RSI source toggle** — Calculated (Python Wilder) vs MT5 built-in (`GrokDevOrderRsiExport` EA).
- **Dual RSI API** — `mt5.shift0/shift1` + Python `rsi`/`completed`; `mt5ExportAvailable`.
- **`GrokDevOrderRsiExport.mq5`**, **`mt5_rsi_export.py`**, **`scripts/compare_mt5_rsi.py`**, **`order-rsi-zone.util.ts`**.

### Fixed
- **Wilder RSI off-by-one** in `rsi_util.py` and `MarketDataService.java` (matches MT5 `iRSI`).
- **Bar times** — UTC → broker/NY/IST; `BROKER_SERVER_ZONE=Etc/GMT-3` (OctaFX).

### Changed
- Publisher: **5000-bar** Wilder warm-up; dual Python + MT5 RSI in payload.
- Sidebar label **Order RSI** → **Analyzer**.

### Documentation
- `docs/order-rsi-mt5-alignment.md`, README, setup, API docs, in-app Docs.

---

## [Unreleased] - 2026-06-28 (Order RSI MT5 alignment — earlier)

### Changed
- **Order RSI publisher** — fetches **5000 bars** per timeframe (`ORDER_RSI_HISTORY_BARS`) for accurate Wilder warm-up (was 44 bars).
- **Order RSI API payload** — each timeframe includes `completed` (shift 1 RSI + time) and `historyBars`.
- **Order RSI UI** — shows **Bar 0 · forming** and **Bar 1 · MT5 Data Window** side by side with alignment guide.

### Added
- **`wilder_rsi_forming_and_completed()`** in `rsi_util.py` — shared shift 0 / shift 1 helper.
- **pytest** coverage for forming vs completed RSI divergence.

### Documentation
- `docs/operations-log.md`, `docs/api-endpoints.md`, `docs/setup-and-run.md`, `python/mt5_xauusd/README.md` updated for MT5 comparison workflow.

---

## [Unreleased] - 2026-06-28 (Reliability pass)

### Added
- **Reliability implementation plan** — [docs/RELIABILITY_IMPLEMENTATION_PLAN.md](docs/RELIABILITY_IMPLEMENTATION_PLAN.md)
- **Python pytest suite** — `python/tests/` for candle filter and poll scheduling
- **`candle_util.py`** — testable completed-candle helpers
- **Spring profiles** — `dev` / `prod` with env-based `DB_*`, `JWT_SECRET`, explicit CORS origins
- **`GlobalExceptionHandler`** — consistent JSON error responses
- **`HealthSnapshotService` + `HealthStreamScheduler`** — shared SSE broadcaster with 15s health cache
- **Frontend `fetchGridWithFallback`** — unified HTTP + IndexedDB offline path
- **E2E dashboard tests** — authenticated shell + bottom nav (`e2e/dashboard.spec.ts`)

### Changed
- **Python daemon polling** — `--poll-seconds` default is `None`; per-TF intervals from config apply by default
- **Postgres client** — `pool_pre_ping`, retry wrapper, `touch_sync_status()` for daemon liveness
- **`sync_status`** updated in one-shot downloads and on empty daemon polls
- **`DEBUG`** env flag in Python config (default false)
- **JWT filter** — scoped `access_token` query param to SSE health stream only; JWT parse errors no longer 500
- **`DataSeeder`** — `@Profile("dev")` only
- **Volatility** — virtual-scrolled mobile cards; offline cache via shared market service
- **Analysis** — uses `MarketDataCacheService` with offline fallback
- **Production Angular build** — `fileReplacements` for `environment.prod.ts`
- Documentation updated across Python, backend, frontend, and API guides

### Fixed
- **AuthControllerTest** — `@AutoConfigureMockMvc(addFilters = false)` for slice test
- **`JwtUtil.validateToken`** — returns false for expired/malformed tokens instead of throwing

---

## [Unreleased] - 2026-06-28 (Mobile-first PWA)

### Mobile-First UI Completion & Optional Follow-Ups

#### Added
- **Playwright e2e suite** (`frontend/e2e/`, `npm run e2e`) — login page, manifest 404 regression, auth-guard redirect; mobile + tablet viewports.
- **PATCH `/api/auth/preferences`** — server deep-merge via `UserService.mergeColumnPreferences()`; Angular `PreferencesService` sends partial section updates only.
- **Gann Analysis module** — swing octave levels + Square-of-9 projections on D1/H4/H1 ([gann.util.ts](frontend/src/app/utils/gann.util.ts)); RSI | Gann tabs in Analysis Lab.
- **SSE health push notifications** — `GET /api/market/xauusd/health/stream` ([HealthStreamController.java](backend/src/main/java/com/grokdev/grokdev/controller/HealthStreamController.java)); dashboard `HealthAlertBannerComponent` + haptic on DEGRADED/DOWN.
- **HealthStreamService** — EventSource subscription with JWT via `?access_token=` (JwtAuthenticationFilter extended).
- **HealthAlertBannerComponent** — dismissible pipeline alert in dashboard shell.
- Unit tests: `gann.util.spec.ts`, expanded `preferences.service.spec.ts` (PATCH).

#### Changed
- **PWA manifest** moved to `frontend/src/assets/manifest.webmanifest` (linked as `assets/manifest.webmanifest`) — fixes 404 during `ng serve`.
- **Login page** redesigned — mobile-first emerald accent, icon inputs, improved alerts, feature pills footer.
- **Canonical route** `/dashboard` ( `/welcome` kept as alias); login navigates to `/dashboard`.
- **Tailwind** — PostCSS build only (CDN removed from index.html).
- **Legacy `welcome.component.ts`** removed; features migrated to routed dashboard pages.
- **In-app Docs** accordion synced with current architecture (PATCH prefs, Gann, SSE, manifest path).
- Documentation updated across `frontend/docs/`, `docs/frontend-guidelines.md`, `docs/api-endpoints.md`, `frontend/README.md`.

#### Fixed
- `manifest.webmanifest` 404 in development (asset path).
- Angular template errors from Tailwind class bindings with slashes (switched to `ngClass`).

---

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
- Bugfix: ensured the ny_session_only param is always sent (as string true/false) and correctly bound in backend with explicit name, so toggle now affects the returned data.
- Validation of real /D1/grid?ny_session_only=true output: recent NY-D1 rows (08:00 nyTime, null spread/realVolume) match expected M15-filter+agg behavior; older rows with 20:00 ny + populated spread do not (indicate pre-agg or non-filtered D1 data). Increased M15 fetch depth (x100) in aggregation path to support larger requested limits for NY D1.
- Deep timezone audit for IST/NY correctness: Confirmed 08:00 NY (EDT) produces 17:30 IST (exactly 5:30 PM IST) under correct base. Root cause for "wrong Indian time" can be (a) broker server zone != UTC (common GMT+2/+3), causing all conversions + NY filter to shift, or (b) Angular date pipe treating no-offset ISO wall-time strings as browser-local (shifts display). 
- Fix: Made broker server zone configurable (`grok.market.broker-server-zone=UTC|GMT+3|...` in application.properties). Enrich now correctly does serverWall.atZone(serverZone) → instant → target zones. 
- Frontend: nyTime/istTime now use safe string formatter (formatWallTime) to display exact computed wall-clock digits independent of viewer's browser TZ. Broker time column keeps prior pipe.
- Overall: Scalable, delightful, trader-focused experience.

### Added
- Analysis section.
- Slide-over column drawer.
- Collapsible sidebar.
- Proper child routed pages with layout component.
- Real data fetching in Market page with large limit.
- NY session only filter for data grid.
- **Configurable broker server timezone** (`grok.market.broker-server-zone`) + safe wall-time display for accurate NY/IST.

### Added (earlier in iteration)
- **Data Grid timezone columns** (Broker / New York / IST):
  - Backend: `XauusdCandle` now carries `nyTime` + `istTime` (converted using broker server zone → instant → target zones).
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