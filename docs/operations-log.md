# Operations Log

Running record of **production/runtime incidents** and **code changes** (why we changed something).

Format for each entry:

- **Date** — short title
- **Symptom** — what the user or logs showed
- **Root cause** — confirmed diagnosis
- **Changes** — files/behavior updated
- **Verification** — how we confirmed the fix

---

## 2026-06-28 — Login returns 401 for admin / admin123

### Symptom

Signing in with demo credentials `admin` / `admin123` showed **Unauthorized** / invalid credentials in the UI.

Stack Pilot backend log (`E:\Source\stack-pilot\logs\backend.log`, read bottom-up):

```
2026-06-28T05:35:50 ERROR ... AuthController : !!! LOGIN FAILED for username='admin'
  - BadCredentialsException: Bad credentials
2026-06-28T05:35:50 INFO  ... AuthController : passwordLength=7, passwordPreview='adm***'
```

Earlier successful logins the same day used `passwordLength=8` (correct for `admin123`).

### Root cause

**Not a broken backend auth stack.** The failing request reached `/api/auth/login` but carried a **7-character password** (e.g. `admin12`), not `admin123` (8 characters). Spring Security correctly rejected it at BCrypt verification (`BadCredentialsException`).

Contributing factors:

1. **Browser autofill / manual typo** — easy to omit the trailing `3`.
2. **Stale JWT on login POST** — `AuthInterceptor` attached an expired Bearer token to login requests, causing noisy JWT filter activity before auth (did not alter the password body).
3. **CORS origin mismatch for LAN access** — frontend served at `http://103.118.183.185:4200` was not in the old explicit CORS allow-list (`localhost` / `127.0.0.1` only). This did not cause the logged failure (request reached the controller) but would block API calls after login from the network URL.

`DataSeeder` confirmed `admin123` hash on every dev startup (`verified=true`).

### Changes

| Area | Change | Why |
|------|--------|-----|
| `AuthController.java` | Trim username/password; reject empty after trim; log `passwordLength` on failure | Normalize input; clearer diagnostics |
| `JwtAuthenticationFilter.java` | Skip filter for `/api/auth/login`, `/refresh`, `/logout` | Avoid stale-token noise on auth endpoints |
| `auth.interceptor.ts` | Do not attach Bearer token to login/refresh | Same as above |
| `login.component.ts` | Trim on submit; **Use demo credentials** button | Prevent typos; one-click correct password |
| `SecurityConfig.java` + `application.properties` | CORS `allowed-origin-patterns` incl. `http://*:4200` | Allow LAN IP frontend (e.g. `103.118.183.185:4200`) |
| `GlobalExceptionHandler.java` | Map malformed JSON body → 400 | Avoid misleading 500 on bad client payloads |

### Verification

- `Invoke-RestMethod POST /api/auth/login` with `admin` / `admin123` → **200**, tokens returned.
- Failed log attempt had `passwordLength=7`; successful attempts had `passwordLength=8`.
- `mvn test` — 12 tests passed.
- `npm run build` — succeeded.

---

## 2026-06-28 — Auto-login on login page (dev testing)

### Symptom

During active testing, manually entering `admin` / `admin123` on every visit slowed iteration.

### Root cause

No automation — login was always manual despite dev-only demo credentials.

### Changes

| Area | Change | Why |
|------|--------|-----|
| `environment.ts` | `autoLogin: true` + default credentials | Dev/testing skips manual auth |
| `environment.prod.ts` | `autoLogin: false` | Production must not auto-sign-in |
| `login.component.ts` | Auto-login on init; redirect if session valid; `?noAutoLogin=1` escape hatch | Seamless dev UX; e2e/manual override |
| `e2e/login.spec.ts` | Use `noAutoLogin=1` for form tests; mock API for auto-login guard test | Keep Playwright stable |

### Verification

- Visit `/login` in dev → redirects to `/dashboard` without manual submit.
- Visit `/login?noAutoLogin=1` → form stays visible.
- Production build uses `autoLogin: false`.

---

## 2026-06-28 — Timeframe freshness shows 0 / 6 (null lastCandleTime)

### Symptom

Overview and Health dashboard showed **`0 / 6 timeframes fresh`**. Per-TF cards showed **NO DATA** or empty “Last candle” despite candle tables containing rows (e.g. M1 grid returned data).

Backend log (`E:\Source\stack-pilot\logs\backend.log`):

```
Writing [{total=6, details={}, freshCount=0, status=UP}]
```

Later (after daemon ran):

```
GET /api/market/xauusd/health → all TFs: lastSynced set, lastCandleTime=null, fresh=false
```

### Root cause

**`sync_status.last_candle_time` was never populated** while the Python daemon only called `touch_sync_status()` on empty incremental polls. That method updated `last_synced` but left `last_candle_time` NULL (or never set it on first insert).

The backend health check treats `last_candle_time == null` as **not fresh** (`isFreshForTimeframe` returns false), so `freshCount` stayed **0** even when `XAUUSD_*` tables held candles.

Secondary bug: when `sync_status` was empty, health returned `status=UP` with `freshCount=0` because the “all fresh” flag defaulted true before the loop.

**Note:** After backfill, `freshCount` may still be **0** if the latest stored candle is older than per-TF thresholds (e.g. last M1 bar from 2026-06-19 vs today 2026-06-28 → correctly **STALE/DOWN** until MT5 ingests newer bars).

### Changes

| Area | Change | Why |
|------|--------|-----|
| `postgres_client.py` | `touch_sync_status` backfills from `MAX(time)` in candle table; new `backfill_sync_status()` | Keep `last_candle_time` aligned with stored data |
| `data_downloader.py` | Call `backfill_sync_status` on daemon/one-shot startup | Repair existing DBs on restart |
| `MarketDataService.java` | Fallback to `MAX(time)` from `XAUUSD_*` when sync row null; always iterate 6 TFs; fix status when none fresh | Accurate health even before Python restart |
| `docs/api-endpoints.md`, `python/mt5_xauusd/README.md` | Document backfill + `source: table_max` detail field | Operator clarity |

### Verification

- `python -c "… backfill_sync_status(TIMEFRAMES)"` → all six TFs get `last_candle_time`.
- `GET /api/market/xauusd/health` → `details.M1.lastCandleTime` populated; cards show **STALE** with dates (not NO DATA).
- `mvn test` passes.

**Operator action:** Restart **python-downloader** and **backend** via Stack Pilot so startup backfill and Java fallback are active.

---

## 2026-06-28 — Health freshCount 0 despite live daemon (MT5 fetch bug)

### Symptom

`/api/market/xauusd/health` returned:

```json
{ "freshCount": 0, "status": "DOWN", "lastSynced": "2026-06-28…", "lastCandleTime": "2026-06-18…" }
```

Daemon was alive (`last_synced` updating every poll) but candle timestamps stuck ~10 days old.

### Root cause

Incremental sync used `mt5.copy_rates_from(..., count=100000)`. On this MT5/OctaFX build, **count=100000 returns 0 bars**; count≤10000 works. The daemon therefore always hit the empty branch → `touch_sync_status()` only → no new rows in Postgres.

Verified in Python REPL:

- `copy_rates_from(..., 100000)` → **0 bars**
- `copy_rates_range(since, now)` → **7886 M1 bars** (2026-06-19 → 2026-06-26)
- `copy_rates_from_pos(0, 5)` → latest bars exist in terminal

After fix + one-shot sync, `lastCandleTime` moves to **2026-06-26** (latest available in MT5). **`freshCount` may still be 0 on weekends** when the last bar is older than per-TF thresholds (M1 &lt; 2 min, etc.) — that is expected until the market reopens.

### Changes

| Area | Change | Why |
|------|--------|-----|
| `mt5_client.py` | Use `copy_rates_range` for incremental; cap `copy_rates_from_pos` at 10000 | Reliable catch-up from MT5 |
| `data_downloader.py` | Log latest candle time on successful sync | Easier log diagnosis |
| `docs/operations-log.md`, `python/mt5_xauusd/README.md` | Document MT5 count limit | Prevent regression |

### Verification

- One-shot incremental sync: M1 +7887 rows, M5 +1577, … latest `lastCandleTime` ≈ 2026-06-26.
- Health API shows updated `lastCandleTime` (not 2026-06-18).
- Restart **python-downloader** in Stack Pilot to pick up `mt5_client.py` fix.

---

## 2026-06-28 — Health page shows DOWN while pipeline is live

### Symptom

Health UI showed red **DOWN**, **0 / 6 fresh**, all cards **STALE**, but **Synced** timestamps were current (Jun 28). Confusing when the downloader was running and last candles were from Friday (market closed).

Angular `date` pipe also shifted UTC candle times to browser local (IST), e.g. `18:29 UTC` displayed as `23:59`.

### Root cause

Overall status was derived only from `freshCount`. When all candles were older than tight thresholds (expected on weekends), status became **DOWN** even with live `last_synced`.

### Changes

| Area | Change | Why |
|------|--------|-----|
| `MarketDataService.java` | `pipelineLive` from recent `last_synced`; status DOWN only when pipeline dead; DEGRADED when live but stale; per-TF `ageMinutes` | Accurate aggregate status |
| `health.component.ts` | `formatBrokerTime` (UTC wall clock), age labels, PIPELINE LIVE badge, contextual copy | Match market grid timezone rules |
| `health-stream.service.ts` | Alert on DOWN only (not weekend DEGRADED) | Reduce false alarms |
| `time.util.ts` | `formatAgeMinutes()` | Readable card ages |

### Verification

- Live daemon + stale Friday candles → **DEGRADED** + **PIPELINE LIVE**, not DOWN.
- Cards show `Last: Jun 26 18:29 UTC` and `Age: 1d … ago`.

---

## Template (copy for future entries)

```markdown
## YYYY-MM-DD — Title

### Symptom
...

### Root cause
...

### Changes
| Area | Change | Why |
|------|--------|-----|

### Verification
...
```
