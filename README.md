# Grok Dev Project

**Repository:** [https://github.com/sivaram311/MT5-Development-Grok](https://github.com/sivaram311/MT5-Development-Grok)

Full-stack application: Spring Boot backend + Angular frontend.

## Tech Stack
- **Backend**: Spring Boot 3.3 + Spring Security + Spring Data JPA + PostgreSQL
- **Frontend**: Angular 18 + Tailwind CSS (via CDN for quick start)
- **Target Devices**: Realme P2 Pro (mobile) + Realme Pad 2 (tablet) - fully responsive

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
- Protected welcome screen with live data from backend
- Responsive design optimized for Realme P2 Pro (phone) + Realme Pad 2 (tablet)

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

**UI/UX**: Modern trading dashboard experience. Clean cards, premium typography, segmented controls, and excellent mobile/tablet responsiveness (Realme P2 Pro + Pad 2 priority). 

The interface is focused on fast access to XAUUSD market data, health monitoring, and trader-centric details.

See [CHANGELOG.md](CHANGELOG.md) for detailed change history (required for all future updates).
- Easy one-command launcher: `.\run-dev.ps1` (opens backend + frontend in separate tabs of the same window)

### Key Endpoints
- POST /api/auth/login → returns accessToken + refreshToken
- POST /api/auth/refresh → get new access token
- GET /api/projects → demo content
- GET /api/welcome

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

## Next Steps (suggested)
- Add more entities/tables
- Improve error handling & logging
- Add Docker support
- Production Postgres config + environment variables

Generated for you by Grok.
