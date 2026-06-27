# Grok Dev - Angular Frontend

**Mobile & Tablet First Trading Dashboard** for XAUUSD market data.

This is the Angular 18 standalone frontend for the Grok Dev full-stack project. It provides a premium, responsive interface optimized primarily for **Realme P2 Pro (phone)** and **Realme Pad 2 (tablet)**, with excellent desktop support.

## Project Philosophy (Mobile/Tablet Priority)
- **Thumb-friendly targets** (min 44px / `min-h-11`)
- **4+1 bottom navigation** on phone (Home, Market, Volatility, Health + More sheet)
- **Collapsible sidebar** at `tablet:` (800px, Realme Pad 2)
- **Card lists on phone**, tables with horizontal scroll on tablet+
- **Bottom sheets** for filters and column settings
- **Shared UI kit** in `src/app/ui/` (PageHeader, SegmentControl, CandleCard, PullToRefresh, etc.)
- **Preference sync** — column order/visibility + market UI saved via PATCH `/api/auth/preferences` (partial merge)
- **Health SSE alerts** — pipeline DEGRADED/DOWN banner in dashboard shell
- **Analysis Lab** — RSI storm scanner + Gann level studies
- **Virtual scroll** — `@angular/cdk` for 500-row market grids
- **Pull-to-refresh** on Home and Market
- **PWA + service worker** — installable app; shell cached offline ([PWA_AND_OFFLINE.md](file:///E:/Source/grok_dev/frontend/docs/PWA_AND_OFFLINE.md))
- **Volatility** — virtual scroll, sort/filter prefs, pull-to-refresh + haptics

All new features (NY Session filter, column customization, health cards, in-app docs) were built with this constraint.

**Rich Technical Documentation** lives right here in the Angular project:
- This README (high-level + setup)
- [frontend/docs/README.md](file:///E:/Source/grok_dev/frontend/docs/README.md) folder containing deep dive files (architecture, schemas, code walkthroughs, data flow, NY feature internals, timezones, mobile UX, etc.)
- In-app **Docs** tab (mobile-friendly accordions with detailed logic via [docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts))

The goal of this documentation is to be **much richer and more detailed** than surface-level overviews. It includes code excerpts, exact algorithms (RSI Wilder, D1 aggregation), configuration, edge cases from real usage, and full integration explanations.

---

## Quick Start (from Angular folder)

```bash
cd grok_dev/frontend
npm install
ng serve
npm run e2e    # Playwright smoke tests (optional)
```

App runs at http://localhost:4200 (configured to bind to all network interfaces, allowing access via local network/public IPs)

Login: `admin` / `admin123`

The frontend talks to Spring Boot at `http://localhost:8081/api` (see [environment.ts](file:///E:/Source/grok_dev/frontend/src/environments/environment.ts)).

---

## High-Level Architecture

The system has three main layers that work together:

1. **Python MT5 Downloader** ([mt5_xauusd](file:///E:/Source/grok_dev/python/mt5_xauusd/)) — Data Ingestion
2. **Spring Boot Backend** (Java root) — API, business logic, auth, calculations
3. **Angular Frontend** (this folder) — UI, state, presentation

### Data Flow (End-to-End)

```
MT5 Terminal
   ↓ (copy_rates_from / copy_rates_from_pos)
Python Downloader (mt5_client + data_downloader + postgres_client)
   ↓ (only completed candles, incremental upsert on "time")
PostgreSQL (grok_dev schema)
   ├── XAUUSD_D1, XAUUSD_H4, ..., XAUUSD_M1
   └── sync_status
   ↓
Spring Boot (JdbcTemplate, no JPA entities for market data)
   ├── MarketDataService (enrichment, NY filter, D1 aggregation, RSI)
   ├── MarketDataController (/api/market/xauusd/*)
   └── Health / Sync endpoints
   ↓ (JSON with Broker/NY/IST times)
Angular (HttpClient + standalone components + shared UI kit)
   ├── DashboardLayout (4+1 mobile nav + tablet sidebar)
   ├── OverviewComponent (live KPIs + recent candles)
   ├── MarketComponent (cards/table + filter sheets)
   ├── VolatilityComponent (sortable volatility grid)
   ├── HealthComponent (freshness cards)
   └── Docs / Analysis
```

Key contract: All market times are stored as **naive TIMESTAMP** representing the broker server's wall clock time.

---

## Database Schema (grok_dev)

### Market Data Tables (auto-created by Python)

All `XAUUSD_*` tables have identical structure:

| Column      | Type      | Notes                              |
|-------------|-----------|------------------------------------|
| time        | TIMESTAMP | PK. Broker server wall time        |
| open        | NUMERIC(12,5) |                                  |
| high        | NUMERIC   |                                    |
| low         | NUMERIC   |                                    |
| close       | NUMERIC   |                                    |
| tick_volume | BIGINT    | MT5 tick volume                    |
| spread      | INTEGER   |                                    |
| real_volume | BIGINT    |                                    |

Tables:
- `XAUUSD_D1`
- `XAUUSD_H4`
- `XAUUSD_H1`
- `XAUUSD_M15`
- `XAUUSD_M5`
- `XAUUSD_M1`

### Supporting Tables

- **sync_status** (PK = timeframe)
  - `last_candle_time`
  - `last_synced`

Used by Python daemon and exposed via `/api/market/xauusd/sync-status` and health.

See full schema in [DATABASE_SCHEMA.md](file:///E:/Source/grok_dev/frontend/docs/DATABASE_SCHEMA.md).

---

## Python Layer (Data Pipeline)

Location: [mt5_xauusd](file:///E:/Source/grok_dev/python/mt5_xauusd/)

### Core Classes

- **MT5Client** ([mt5_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py)): Handles `mt5.initialize()`, `copy_rates_from_pos`, `copy_rates_from`. Always drops the last (forming) bar.
- **PostgresClient** ([postgres_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py)): Uses SQLAlchemy + `ON CONFLICT DO NOTHING` on `time` for safe upserts. Creates tables dynamically.
- **XAUUSDDownloader** ([data_downloader.py](file:///E:/Source/grok_dev/python/mt5_xauusd/data_downloader.py)):
  - `download_all()` — one-shot full or incremental.
  - `run_continuous_sync()` — daemon mode using smart per-timeframe polling intervals.

### Key Logic

```python
# Only completed candles
df = ...fetch...
df = df.iloc[:-1] if len(df) > 1 else df

# Incremental
last_ts = pg.get_last_timestamp(...)
df = df[df['time'] > last_ts]
```

Smart polling (from config):
- M1: 15s
- M5: 30s
- M15: 60s
- H1: 3m
- H4: 10m
- D1: 30m

See [PYTHON_MT5_DOWNLOADER.md](file:///E:/Source/grok_dev/frontend/docs/PYTHON_MT5_DOWNLOADER.md).

---

## Spring Boot Backend

### Market Data Service (Most Important Class)

[MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java)

**Core methods**:

1. `getXauusdData(tf, from, to, limit)` — raw query + `enrichTimezoneFields`
2. `getXauusdGridData(tf, limit, nySessionOnly)` — the heart of the grid

**NY Session Only Deep Logic** (when `nySessionOnly=true`):

- Non-D1: Simple filter on already-enriched `nyTime.hour` (8 <= h < 17)
- **D1 special path**:
  1. Fetch lots of recent M15
  2. Filter to NY session bars using computed `nyTime`
  3. `aggregateNySessionToDaily()`:
     - Group by `nyTime.toLocalDate()`
     - Per group: open=first, high=max, low=min, close=last, volume=sum
     - Representative `time` = first M15 bar's broker time (usually the 08:00 NY bar)
  4. Re-enrich the synthetic daily rows
  5. Calculate RSI(14) Wilder **only on the filtered series**
  6. Return newest N rows (DESC)

**Timezone Enrichment** (critical recent fix):

```java
// Configurable
@Value("${grok.market.broker-server-zone:UTC}")
private String brokerServerZoneId;

ZonedDateTime serverZdt = brokerWallTime.atZone(serverZone);
c.setNyTime( serverZdt.withZoneSameInstant(nyZone).toLocalDateTime() );
c.setIstTime( ... );
```

This makes NY 08:00 EDT correctly map to IST 17:30 (5:30 PM) regardless of whether your broker is on UTC, GMT+2, or GMT+3.

See [SPRINGBOOT_BACKEND.md](file:///E:/Source/grok_dev/frontend/docs/SPRINGBOOT_BACKEND.md) and [TIMEZONE_HANDLING.md](file:///E:/Source/grok_dev/frontend/docs/TIMEZONE_HANDLING.md).

### Controllers
- [MarketDataController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/MarketDataController.java) exposes `/api/market/xauusd/{tf}/grid?limit=500&ny_session_only=true` and `/health` (freshness verification).
- [AuthController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/AuthController.java) exposes `/api/auth/preferences` for user-level column display configurations.

---

## Angular Frontend (This Project)

### Routing (Modern Standalone)

```ts
// app.routes.ts — canonical /dashboard, /welcome alias
{ path: 'dashboard', component: DashboardLayoutComponent, canActivate: [AuthGuard],
  children: [
    { path: 'overview', loadComponent: ... },
    { path: 'market', ... },
    { path: 'volatility', ... },
    { path: 'health', ... },
    { path: 'analysis', ... },
    { path: 'docs', ... }
  ]
}
```

See [app.routes.ts](file:///E:/Source/grok_dev/frontend/src/app/app.routes.ts).

### Key Components (Mobile-First)

- **[dashboard-layout.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts)**
  - Sticky header with logo + user
  - Collapsible sidebar (md+)
  - **Fixed bottom nav** on mobile (`md:hidden`)
  - Router outlet

- **[market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts)**
  - Timeframe select + **"NY Session Only"** checkbox (immediate reload)
  - "Customize columns" drawer (slide from right)
  - Table with safe `formatWallTime()` (prevents browser TZ shifting NY/IST display)
  - Empty state tells user to run Python downloader

- **[volatility.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/volatility.component.ts)** (Volatility Explorer)
  - Variable lookback limits and timeframe selector.
  - Aligns Day of Week, Broker time, NY time, and IST time.
  - Displays OHLC prices and range difference (`High - Low`) sorted by highest diff by default.
  - Highlights highly volatile periods and supports CSV exports.

- **[health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts)**
  - Calls real `/health` endpoint
  - Per-TF cards with FRESH / STALE colors
  - Shows `lastCandleTime` (helps debug stale grid views)

- **[auth.guard.ts](file:///E:/Source/grok_dev/frontend/src/app/guards/auth.guard.ts)** + **[auth.interceptor.ts](file:///E:/Source/grok_dev/frontend/src/app/interceptors/auth.interceptor.ts)**
  - Proactive refresh token logic; 401 redirects to `/login?reason=session_expired`

- **[login.component.ts](file:///E:/Source/grok_dev/frontend/src/app/login/login.component.ts)**
  - Mobile-first sign-in UI with show/hide password and session-expired messaging

### Column Visibility & Persistence

Implemented in [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts) and [preferences.service.ts](file:///E:/Source/grok_dev/frontend/src/app/services/preferences.service.ts):

- Drag-and-drop column reorder, visibility toggles, presets, TSV copy
- Per-timeframe grid prefs + market UI synced via PATCH merge to `/api/auth/preferences`
- Legacy key mapping (`broker→time`, etc.) on load

### E2E Tests

Playwright config in [playwright.config.ts](file:///E:/Source/grok_dev/frontend/playwright.config.ts). Run `npm run e2e` for login, manifest, and auth-guard smoke tests on mobile + tablet viewports.

---

## Running Everything

Preferred launcher (executes all processes):
```powershell
cd E:\Source\grok_dev
.\run-dev.ps1
```

Manual execution:
1. Start MT5 Terminal.
2. Spring Boot: `cd backend && mvn spring-boot:run`
3. Angular: `cd frontend && ng serve`
4. Python: `cd python && python run_data_downloader.py --daemon`

---

## Troubleshooting Data Freshness

If the grid's newest row is days old:
1. Open the **Health** tab in the Angular app to check D1 `lastCandleTime`.
2. Confirm the Python downloader is running and MT5 terminal is active.
3. Check the `sync_status` table in PostgreSQL.

See [CHANGELOG.md](file:///E:/Source/grok_dev/CHANGELOG.md) for detailed iteration history.