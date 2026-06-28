# Grok Dev Project

**Repository:** [https://github.com/sivaram311/MT5-Development-Grok](https://github.com/sivaram311/MT5-Development-Grok)

Full-stack application: Spring Boot backend + Angular frontend.

## Tech Stack
- **Backend**: Spring Boot 3.3 + Spring Security + Spring Data JPA + PostgreSQL
- **Frontend**: Angular 18 + Tailwind CSS (PostCSS build) + Playwright e2e
- **Target Devices**: Realme P2 Pro (mobile) + Realme Pad 2 (tablet) — mobile-first PWA

## Setup Instructions

### 1. Database (PostgreSQL)
```sql
CREATE DATABASE postgres;  -- or use existing
-- The app will create schema `grok_dev`
```

Run the app - it will create the schema and insert `admin` / `admin123` (BCrypt encoded).

### 2. Backend (Spring Boot)
```bash
cd backend
mvn spring-boot:run
```
- Backend runs on port 8081 (or next free port auto-detected by run-dev.ps1)
- Frontend on 4200 (update src/environments/environment.ts apiUrl if needed)
- Auth API: POST /api/auth/login

### 3. Frontend (Angular)
First install dependencies (requires Node.js + Angular CLI):
```bash
cd frontend
npm install
ng serve
```

Then access http://localhost:4200

**E2E smoke tests** (optional, from `frontend/`):
```bash
npm run e2e
```

**Demo Login:**
- Username: `admin`
- Password: `admin123`

The admin account (and a test user) is **automatically created and password re-hashed** on every application startup via `DataSeeder.java` (using the live `PasswordEncoder` bean).

This guarantees `admin / admin123` always works.

**Timezone note for market data**: Set `grok.market.broker-server-zone` in `backend/src/main/resources/application.properties` (e.g. `GMT+3`) for correct NY/IST conversions and the "NY Session Only" feature. See `docs/setup-and-run.md`.

If login fails:
```sql
DELETE FROM grok_dev.users WHERE username IN ('admin', 'user1');
```
Then restart the backend. The seeder will recreate them.

## Features Implemented
- **JWT + Refresh Token** authentication (access token + long-lived refresh token stored in DB)
- Role-based users (admin/user)
- Additional tables: roles, user_roles, projects (demo data)
- **Mobile-first dashboard** at `/dashboard` (`/welcome` alias) with live XAUUSD data from backend
- Responsive design optimized for Realme P2 Pro (phone) + Realme Pad 2 (tablet)
- **PWA** — installable app, service worker (production), manifest at `assets/manifest.webmanifest`
- **Market grid** — cards/table toggle, virtual scroll, drag-and-drop columns, NY Session filter, offline IndexedDB cache
- **Volatility explorer** — sortable grid with per-TF preference sync
- **Health dashboard** — per-TF freshness cards + **SSE push alerts** when pipeline degrades
- **Analysis Lab** — RSI storm scanner + Gann level studies (octave + Square-of-9)
- **Analyzer** — live multi-TF RSI(14) table, classic S/R pivots, **Gann Odd Square** (So9), toggleable rows — route `/dashboard/order-rsi`; see [docs/order-rsi-mt5-alignment.md](docs/order-rsi-mt5-alignment.md)
- **Gann Intraday** — five-module intraday Gann page (1×1 angle, session pivots, fine So9, time squaring, NY/London killzones) — route `/dashboard/gann-intraday`; API `GET /api/market/xauusd/gann-intraday`; **usage guide:** [frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md](frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md); implementation tracker: [docs/gann-intraday-pending-implementation.md](docs/gann-intraday-pending-implementation.md)
- **User preferences** — PATCH merge to `/api/auth/preferences` (grid, market UI, volatility)
- **Playwright e2e** — login, manifest, auth-guard smoke tests (`npm run e2e`)

## MT5 Market Data Pipeline (Python)
Python scripts under `python/mt5_xauusd/` connect to MT5 and pull historical XAUUSD OHLC data into the shared `grok_dev` Postgres schema.

Supported timeframes:
- XAUUSD_D1, XAUUSD_H4, XAUUSD_H1, XAUUSD_M15, XAUUSD_M5, XAUUSD_M1

**Run:**
```powershell
cd python
pip install -r requirements.txt

# Recommended:
python -m mt5_xauusd.main
# or
python run_data_downloader.py

# Examples:
python -m mt5_xauusd.main --timeframes D1 H4
python -m mt5_xauusd.main --no-incremental

# Live continuous sync - defaults to ALL timeframes + smart per-TF intervals
# (only updates completed candles). Override with --poll-seconds for uniform.
python run_data_downloader.py
# or
python -m mt5_xauusd.main --daemon
```

Data is queryable from Spring Boot via `/api/market/xauusd/{timeframe}`.

See `python/mt5_xauusd/README.md` and `python/mt5_xauusd/INTEGRATION.md` for details (includes troubleshooting for import errors and "Failed to initialize MT5").

**Critical:** 
- Start and log into the MT5 terminal **before** running the Python downloader.
- The downloader auto-detects `terminal64.exe` in common locations. If needed, set `MT5_PATH` in `python/mt5_xauusd/config.py`.
- For ongoing sync of new completed candles: run with `--daemon` or just `python run_data_downloader.py` (smart per-TF intervals by default).

**UI/UX**: Mobile-first PWA with 4+1 bottom nav, service worker (offline shell), virtual-scrolled grids, pull-to-refresh with haptics, backend-synced preferences (PATCH merge), and live health SSE alerts. Optimized for Realme P2 Pro + Pad 2.

See [CHANGELOG.md](CHANGELOG.md) for detailed change history.

## Documentation (Deep Technical)

Rich technical documentation lives **inside the Angular project**:
- [frontend/README.md](file:///E:/Source/grok_dev/frontend/README.md) (Main technical guide & setup)
- [frontend/docs/](file:///E:/Source/grok_dev/frontend/docs/) folder containing deep dives:
  - [TECHNICAL_OVERVIEW.md](file:///E:/Source/grok_dev/frontend/docs/TECHNICAL_OVERVIEW.md) (Architecture overview)
  - [DATABASE_SCHEMA.md](file:///E:/Source/grok_dev/frontend/docs/DATABASE_SCHEMA.md) (Database details)
  - [PYTHON_MT5_DOWNLOADER.md](file:///E:/Source/grok_dev/frontend/docs/PYTHON_MT5_DOWNLOADER.md) (MT5 daemon)
  - [SPRINGBOOT_BACKEND.md](file:///E:/Source/grok_dev/frontend/docs/SPRINGBOOT_BACKEND.md) (API controllers)
  - [ANGULAR_FRONTEND.md](file:///E:/Source/grok_dev/frontend/docs/ANGULAR_FRONTEND.md) (UI layouts)
  - [GANN_INTRADAY_USAGE_GUIDE.md](file:///E:/Source/grok_dev/frontend/docs/GANN_INTRADAY_USAGE_GUIDE.md) (Gann Intraday page tutorial)
  - [NY_SESSION_ONLY_FEATURE.md](file:///E:/Source/grok_dev/frontend/docs/NY_SESSION_ONLY_FEATURE.md) (Session filtering)
  - [TIMEZONE_HANDLING.md](file:///E:/Source/grok_dev/frontend/docs/TIMEZONE_HANDLING.md) (DST calculations)
  - [MOBILE_TABLET_UX.md](file:///E:/Source/grok_dev/frontend/docs/MOBILE_TABLET_UX.md) (Layout constraints)
  - [PWA_AND_OFFLINE.md](file:///E:/Source/grok_dev/frontend/docs/PWA_AND_OFFLINE.md) (Installable PWA + offline shell)
  - [UI_IMPLEMENTATION_PLAN.md](file:///E:/Source/grok_dev/frontend/docs/UI_IMPLEMENTATION_PLAN.md) (Completed UI roadmap)
  - [DATA_FLOW_AND_INTEGRATION.md](file:///E:/Source/grok_dev/frontend/docs/DATA_FLOW_AND_INTEGRATION.md) (Ingestion tracing)
- Root docs: [docs/frontend-guidelines.md](docs/frontend-guidelines.md), [docs/api-endpoints.md](docs/api-endpoints.md), [docs/setup-and-run.md](docs/setup-and-run.md), [docs/order-rsi-mt5-alignment.md](docs/order-rsi-mt5-alignment.md)
- **MQL5 EAs:** [python/mt5_scripts/README.md](python/mt5_scripts/README.md) (install, compile, Order RSI + Gann scanner)

A condensed, mobile-friendly version of the docs is also available inside the live app (tap **Docs** in the bottom navigation on phones) — see [docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts). 

All documentation was written with priority given to readability on small screens.
- Easy one-command launcher: `.\run-dev.ps1` (opens backend + frontend in separate tabs of the same window)

### Key Endpoints
- POST /api/auth/login → returns accessToken + refreshToken
- POST /api/auth/refresh → get new access token
- GET /api/auth/preferences → load user UI preferences (JSON)
- PATCH /api/auth/preferences → deep-merge partial preferences (preferred)
- GET /api/market/xauusd/{tf}/grid → OHLC grid with RSI (+ optional NY session filter)
- GET /api/market/xauusd/health → pipeline freshness (UP / DEGRADED / DOWN)
- GET /api/market/xauusd/health/stream → SSE push stream (30s interval)
- GET /api/market/xauusd/order-rsi → live Order RSI snapshot (Python Wilder + optional MT5 iRSI)
- GET /api/market/xauusd/order-rsi/stream → SSE push when snapshot updates (~250ms)
- GET /api/projects → demo content

## Analyzer (live RSI panel)

Second Python process (`python run_order_rsi.py`) publishes forming-bar RSI for **W1, D1, H4, H1, M15, M5, M1** into `grok_dev.live_order_rsi`.

**Frontend:** bottom nav **Analyzer** (`/dashboard/order-rsi`) — RSI/S/R table + **Gann Odd Square** block below; toggleable rows (**B0SR**, **B1SR**, **Odd Sq**, **Even Sq**); zone-colored RSI; page toggle **Calculated** vs **MT5 built-in**.

**Run via Stack Pilot:** start service `python-order-rsi` after MT5 is logged in.

**Optional MT5 verify:** pre-built EA `python/mt5_scripts/GrokDevOrderRsiExport.ex5` — copy to MT5 `Experts`, attach on XAUUSD (Algo Trading ON). **MQL5 guide:** [python/mt5_scripts/README.md](python/mt5_scripts/README.md) · [order-rsi-mt5-alignment.md](docs/order-rsi-mt5-alignment.md).

Full guide: [docs/order-rsi-mt5-alignment.md](docs/order-rsi-mt5-alignment.md)

## SOLID & Design Patterns
See docs/solid-and-patterns.md for details on how the project follows clean architecture.

## Prerequisites (Important!)

You need these tools installed:

- Java 21 (JDK)
- Maven (or Maven Wrapper `mvnw.cmd`)
- Node.js + npm
- Angular CLI (`npm install -g @angular/cli`)

**Recommended way to run both apps:**

```powershell
cd E:\Source\grok_dev
.\run-dev.ps1
```

This is a **minimal** script that tries to open:
- Backend in one tab
- Frontend in another tab

(using Windows Terminal when available)

Full guide + troubleshooting → **`docs/setup-and-run.md`**

## Reliability & testing

See [RELIABILITY_IMPLEMENTATION_PLAN.md](docs/RELIABILITY_IMPLEMENTATION_PLAN.md) for the cross-stack hardening roadmap.

```powershell
cd python && pytest tests/ -q
cd backend && mvn test
cd frontend && npm run e2e
```

**Backend profiles:** Default `dev` (seeder + verbose logs). Production: `SPRING_PROFILES_ACTIVE=prod` with `JWT_SECRET`, `DB_*` env vars.

**Python daemon:** Per-TF poll intervals apply by default; use `--poll-seconds 45` only to force uniform polling.

## Next steps (suggested)

- Full authenticated e2e against live backend (login → market grid)
- Docker compose for backend + Postgres + frontend
- API rate limiting

Generated for you by Grok.
