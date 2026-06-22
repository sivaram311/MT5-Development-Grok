# Setup & Run Instructions

> Source: [https://github.com/sivaram311/MT5-Development-Grok](https://github.com/sivaram311/MT5-Development-Grok) (grok_dev folder)

## Prerequisites

### 1. Java Development Kit (JDK 21) - REQUIRED
- Download: https://adoptium.net/temurin/releases/?version=21 (recommended)
- Or Oracle: https://www.oracle.com/java/technologies/downloads/#java21
- **Important**: After installing, **restart your PowerShell** or PC.
- Verify:
  ```powershell
  java -version
  ```

### 2. Apache Maven
- Option A (Easiest): Use Maven Wrapper (already supported).
- Option B: Download from https://maven.apache.org/download.cgi and add to PATH.
- Verify:
  ```powershell
  mvn -version
  ```

### 3. Node.js + npm (REQUIRED for Angular)
- Download LTS: https://nodejs.org/
- This installs both `node` and `npm`.
- After install, **restart PowerShell**.
- Verify:
  ```powershell
  node --version
  npm --version
  ```

### 4. Angular CLI
```powershell
npm install -g @angular/cli
ng version
```

### 5. PostgreSQL
- Download: https://www.postgresql.org/download/windows/
- Remember the password you set for user `postgres`.
- The app will automatically create the `grok_dev` schema.

## Quick Verification
Run these commands in PowerShell to check if everything is ready:

```powershell
java -version
mvn -version
node --version
npm --version
ng version
```

If any command says "not recognized", that tool is missing or not added to PATH. Restart PowerShell after installing.

## 1. Database
```bash
psql -U postgres
CREATE DATABASE postgres;
# Schema + tables created automatically on app start
```

## 2. Backend
```bash
cd backend
mvn clean install
mvn spring-boot:run
```
API available at http://localhost:8081

## 3. Frontend
```bash
cd frontend
npm install
ng serve
```
Open http://localhost:4200

## Login
- **admin / admin123**

**Important**: The admin user is **automatically created and its password re-hashed** every time the application starts by `DataSeeder.java`.

This is done in `src/main/java/com/grokdev/grokdev/config/DataSeeder.java` using the live `PasswordEncoder` bean.

If you ever see validation/credential errors for admin, delete the user(s) from the database and restart the app:

```sql
DELETE FROM grok_dev.users WHERE username IN ('admin', 'user1');
```

The `DataSeeder` will recreate them with fresh, correctly encoded passwords on the next startup.

On startup look for this log line (confirms table + BCrypt):
```
>>> Admin credentials ensured: admin / admin123 (verified=true, hashPrefix=$2a$10$...)
```
If verified=false, the passwordEncoder did not match what was stored — check for old compiled classes or restart clean.

## First Login Flow
1. Enter credentials → both `accessToken` + `refreshToken` returned
2. Tokens stored in localStorage
3. Redirect to `/welcome`
4. `ensureValidSession()` runs (proactive refresh if needed)
5. Interceptor attaches access token
6. `/api/welcome` and `/api/projects` called
7. UI shows **live countdown** for token expiration + "Refresh Token" button
8. Role-based content appears (Admin panel visible only for admin user)

## Refresh Token Behavior
- Access token: ~24h
- Refresh token: ~7 days (stored server-side)
- Automatic refresh on 401 or on app start if access token expired
- Logout revokes refresh token server-side

## Running Both Apps Easily (Minimal Script)
Use the provided minimal launcher:

## MT5 Data Pipeline (Python)

A dedicated Python module pulls historical XAUUSD data from MT5 into the `grok_dev` schema.

**UI/UX Focus**: The market data UI in the Welcome screen is designed from the trader's perspective:
- Thumb-friendly timeframe pills (horizontal scroll)
- Large, prominent latest price with instant % change
- Interactive price chart + responsive candle cards/table
- Quick presets and refresh for ease on mobile/tablet
- Color coding (green/red) for direction at a glance

Always prioritized mobile/tablet responsiveness.

**Location:** `python/mt5_xauusd/`

**Supported Tables:**
- `XAUUSD_D1`, `XAUUSD_H4`, `XAUUSD_H1`, `XAUUSD_M15`, `XAUUSD_M5`, `XAUUSD_M1`

### Setup
```bash
cd python
pip install -r requirements.txt
```

Create `.env` from `.env.example` if you need custom DB credentials.

### Run
```powershell
# Make sure MT5 is running and logged in with XAUUSD visible
cd python

# One-time / catch-up:
python -m mt5_xauusd.main

# Continuous live sync (recommended):
# Defaults to ALL timeframes with smart per-TF intervals (M1:15s, M5:30s, M15:60s, H1:3m, H4:10m, D1:30m)
python run_data_downloader.py
# or
python -m mt5_xauusd.main --daemon

# Force uniform interval (e.g. every 45s for all):
python run_data_downloader.py --daemon --poll-seconds 45

# Custom:
python -m mt5_xauusd.main --daemon --poll-seconds 20 --timeframes M1 M5 M15 H1
```

**Important:** 

- Always run from the `python` folder.
- **Start MT5 terminal first and log in** before running the Python script.
- The script now auto-detects common MT5 paths. If it can't find it, edit `MT5_PATH` in `python/mt5_xauusd/config.py` with the full path to `terminal64.exe`.
- If you see `ModuleNotFoundError: No module named 'config'`, use the commands above.

See `python/mt5_xauusd/README.md` for full troubleshooting (including MT5 init errors).

The script supports **incremental updates** by default.

- First run: tables are auto-created, full history downloaded.
- `--daemon` mode: keeps the DB in sync with **only completed candles**.

**Important completed-candle logic**:
- MT5 always returns the *currently forming* bar as the last row in recent fetches.
- We always drop `df.iloc[:-1]` (last bar) before upsert.
- Only insert/update bars where time > last in DB.
- Default: all 6 timeframes using smart per-TF intervals (M1:15s, M5:30s, M15:60s, H1:3m, H4:10m, D1:30m). Use --poll-seconds for uniform.

Data becomes immediately available via Spring Boot endpoints:
- `GET /api/market/xauusd/D1?limit=500`
- `GET /api/market/xauusd/H4?from=2025-01-01&to=2025-06-01`
- `GET /api/market/xauusd/D1/grid?limit=200` (includes RSI(14))

The `/grid` endpoint (and the Data Grid tab) now correctly returns the most recent candles by using `ORDER BY time DESC LIMIT` + reverse in the service (previously it was fetching oldest data).

See `python/mt5_xauusd/README.md` and `INTEGRATION.md` for more (including detailed recommendations for live syncing, Task Scheduler setup, and health monitoring).

### Market Data Timezone Configuration (NY Session + IST/NY columns)
The stored `time` values from MT5 are broker **server wall times** (not necessarily UTC).

To get correct `nyTime` / `istTime` (and correct filtering/aggregation when "NY Session Only" is enabled):

Edit `backend/src/main/resources/application.properties`:
```properties
grok.market.broker-server-zone=UTC          # default; change if needed
# Common alternatives:
# grok.market.broker-server-zone=GMT+2
# grok.market.broker-server-zone=GMT+3
```

- Restart the backend after changing.
- This affects:
  - "NY Session Only" toggle (08:00–17:00 NY wall time).
  - D1 re-aggregation from M15 NY-session bars only.
  - Displayed NY and IST columns (e.g. NY 08:00 EDT → IST 17:30 / 5:30 PM).
- The zone is used as: `brokerWall.atZone(serverZone)` → true instant → `.withZoneSameInstant(...)` for NY/IST.
- The frontend now formats NY/IST wall times safely (independent of your browser's local timezone) so the numbers you see match the server-computed wall clock.

If your MT5 terminal shows a different server time (check Market Watch), set the matching offset and re-validate with `/api/market/xauusd/D1/grid?ny_session_only=true`.

### Health & Monitoring
- Python daemon updates `grok_dev.sync_status` (last_candle_time + last_synced) and writes rotating logs to `python/logs/xauusd_sync.log`.
- Spring Boot:
  - `GET /api/market/xauusd/health` → {status: "UP"/"DEGRADED"/"DOWN", freshCount, total, details per TF with fresh flag, checkedAt}
  - `GET /api/market/xauusd/sync-status`
- Dedicated **Health Dashboard** (in Welcome page): overall status badge + X/6 fresh summary + 6 per-TF cards (FRESH or age). Uses backend thresholds for accuracy.
- Windows Task Scheduler: `python/setup_task_scheduler.ps1` (Run as Administrator). Auto-detects Python, startup+logon triggers, robust restarts.
- File logging enabled automatically in daemon.

See root [CHANGELOG.md](../../CHANGELOG.md) for all application changes (updated with every modification).

## Architecture Overview
- Python MT5 scripts → raw OHLC data in Postgres (`grok_dev` schema)
- Spring Boot → queries the data + exposes REST APIs
- Angular → consumes APIs for charts, analysis, Gann theory, etc.


```powershell
cd E:\Source\grok_dev
.\run-dev.ps1
```

The script:
- Finds the first available port starting from 8081 for the backend and passes `--server.port=XXXX` to Maven.
- Opens two tabs in the same Windows Terminal window (if installed):
  - Tab 1: Spring Boot backend (`mvn spring-boot:run`)
  - Tab 2: Angular frontend (`npm run start`)

**Tip:** Install **Windows Terminal** from the Microsoft Store for the cleanest tab experience. If not installed, it will open two separate PowerShell windows.

The script auto-selects a free port for the backend (starting at 8081) and passes it as `--server.port`. The Angular environment defaults to 8081 — update `src/environments/environment.ts` if needed.

**Note on port:** The script auto-detects the next free port starting from 8081 and passes it to the backend.

Angular frontend defaults to calling `http://localhost:8081/api` (see `src/environments/environment.ts`).

If the script picks a different port (rare), manually update `environment.ts` (apiUrl) and restart `ng serve`.

## Troubleshooting the run-dev.ps1 Script

This is a **minimal** script modeled after working CIM-style launchers.

### Verify your tools
```powershell
java -version
mvn -version
node --version
npm --version
ng version
```

### Common Problems
- **"Unexpected token" or quoting errors** → The script file has bad characters or old quoting. Replace `run-dev.ps1` with the clean minimal version.
- **"The system cannot find the file specified"** when using tabs → Install **Windows Terminal** from the Microsoft Store.
- Tools not found → Restart PowerShell after installing.

**Recommended fix**: Use the current minimal `run-dev.ps1` (shown in this doc or re-created from the latest version in the project).

### Backend Startup Error: "For input string: \"604800000#7days\""
This error occurs when Spring tries to parse `jwt.refresh-expiration-ms`.

**Cause**: Inline comment (`# comment`) after the value in `.properties` file is included in the value.

**Fix**: Keep the value clean (no inline comments):

```properties
jwt.refresh-expiration-ms=604800000
```

(Comments must be on their own line starting with `#`.)

### Login validation failure for admin / admin123
- The credentials are seeded at runtime by `DataSeeder.java` (see `backend/src/main/java/.../config/DataSeeder.java`).
- This guarantees a fresh BCrypt hash matching the `PasswordEncoder` bean.
- If login fails:
  1. Check backend logs for messages like `>>> Admin user created successfully`.
  2. Manually delete the user from DB: `DELETE FROM grok_dev.users WHERE username='admin';`
  3. Restart the backend application.

**Never** hardcode BCrypt hashes in `data.sql` – they can mismatch the encoder strength or version.

### Manual Launch (always works)
Open two PowerShell tabs:

**Tab 1 – Backend**
```powershell
cd E:\Source\grok_dev\backend
mvn spring-boot:run
```

**Tab 2 – Frontend**
```powershell
cd E:\Source\grok_dev\frontend
npm install
ng serve
```
