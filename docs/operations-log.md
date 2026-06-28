# Operations Log

Running record of **production/runtime incidents** and **code changes** (why we changed something).

Format for each entry:

- **Date** — short title
- **Symptom** — what the user or logs showed
- **Root cause** — confirmed diagnosis
- **Changes** — files/behavior updated
- **Verification** — how we confirmed the fix

---

## 2026-06-28 — Gann dual grids (Bar 1 close + Bar 0 open)

### Changes
| Area | Change |
|------|--------|
| `order_rsi_service.py` | `open`, `gannBar1`, `gannBar0`; pivot shared when Odd/Even on |
| `order-rsi.component.ts` | Two Gann tables; separate toggles; Bar 0 unavailable banner |

**Verification:** restart `python-order-rsi`.

---

## 2026-06-28 — Analyzer Gann Odd Square (Square of Nine)

### Changes

| Area | Change |
|------|--------|
| `gann_odd_square_util.py` | Odd (√P±2n)² and even (√P±(2n±1))² bands from Bar 1 close pivot |
| `order_rsi_service.py` | Adds `timeframes.{TF}.gann` to live snapshot |
| `order-rsi.component.ts` | Separate Gann table below RSI/S/R grid; **Odd Sq** / **Even Sq** toggles |
| Docs | Alignment guide, API, README, in-app Docs |

**Verification:** `pytest python/tests/test_gann_odd_square_util.py`; restart `python-order-rsi`.

---

## 2026-06-28 — Analyzer S/R label key fix

### Symptom
S3/S2/S1 rows showed resistance-band prices and R1/R2/R3 showed support-band prices (names inverted vs MT5).

### Changes
| Area | Change |
|------|--------|
| `pivot_util.py` | Swap `sr` key assignment so UI labels match terminal |
| Docs | `order-rsi-mt5-alignment.md`, `api-endpoints.md`, `ANGULAR_FRONTEND.md` |

**Verification:** `pytest python/tests/test_pivot_util.py`; restart `python-order-rsi`.

---

## 2026-06-28 — Analyzer classic S/R pivots (B0SR / B1SR)

### Changes

| Area | Change |
|------|--------|
| `pivot_util.py` | Classic floor pivots from bar H/L/C |
| `order_rsi_service.py` | Adds `sr` on forming bar, `completed.sr` on closed bar per TF |
| `order-rsi.component.ts` | Seven S/R rows per bar group; **B0SR** / **B1SR** visibility chips |
| Docs | API, alignment guide, README, in-app Docs |

**Verification:** `pytest python/tests/test_pivot_util.py`; restart `python-order-rsi` in Stack Pilot for live data.

---

## 2026-06-28 — Analyzer table UI + nav rename

### Changes

| Area | Change |
|------|--------|
| `dashboard-layout.component.ts` | Nav label **Order RSI** → **Analyzer** (route unchanged: `order-rsi`) |
| `order-rsi.component.ts` | TF-column table; rows: Bar 0 RSI, Bar 0 data, Bar 1 RSI, Bar 1 data; row visibility toggles |
| Docs | README, alignment guide, setup, API, in-app Docs |

---

## 2026-06-28 — Order RSI vertical stack + zone highlights + source toggle

### Changes

| Area | Change |
|------|--------|
| `order-rsi.component.ts` | Vertical card stack (one per TF); zone-colored RSI boxes; page toggle Calculated / MT5 built-in |
| `order-rsi-zone.util.ts` | Zone rules: red &lt;40, yellow 40–44 &amp; 56–60, neutral 45–55, green &gt;60 |
| `order_rsi_service.py` | Payload includes both `rsi`/`completed` (Python) and `mt5.shift0/shift1`; `mt5ExportAvailable` |
| Docs | `api-endpoints.md`, `order-rsi-mt5-alignment.md`, `setup-and-run.md` |

### Verification

- `npm run build` — pass.
- Toggle MT5 built-in requires `GrokDevOrderRsiExport` EA + restart `python-order-rsi`.

---

## 2026-06-28 — Order RSI still mismatched MT5 (Wilder off-by-one bug)

### Symptom

After history + shift-1 UI, API still disagreed with MT5 terminal RSI. Example from live snapshot:

| TF | App (buggy) bar 0 | App (buggy) bar 1 | Fixed bar 0 | Fixed bar 1 |
|----|-------------------|-------------------|-------------|-------------|
| M1 | **85.89** | 84.66 | **80.83** | 85.89 |
| M5 | 65.86 | 58.77 | 72.82 | 65.86 |

User's **85.89** on M1 bar 0 equaled **fixed bar 1** — app was one bar ahead of MT5 iRSI.

### Root cause

**Wilder RSI loop bug** in `rsi_util.py`: the first smoothing step double-counted `gains[period]`, so RSI at the forming index matched MT5 **shift 1** (previous closed bar), not shift 0.

Secondary: bar `time` from `copy_rates` is **UTC** but was labeled as broker wall with `BROKER_SERVER_ZONE=UTC` while OctaFX charts use **UTC+3** — confusing which candle to compare in Data Window.

### Changes

| Area | Change |
|------|--------|
| `rsi_util.py` | Correct Wilder loop: first RSI at bar `period`, smooth from `period+1` |
| `MarketDataService.java` | Same Wilder fix for grid RSI |
| `order_rsi_service.py` | Bar times from UTC → broker/NY/IST; optional read of `GrokDevOrderRsiExport.mq5` JSON |
| `mt5_scripts/GrokDevOrderRsiExport.mq5` | EA writes MT5 `iRSI` shift 0/1 to Common Files for verification |
| Config | `BROKER_SERVER_ZONE=Etc/GMT-3` (OctaFX) in Python, backend, Stack Pilot |

### Verification

```powershell
cd python
python scripts/compare_mt5_rsi.py
# M1 APP shift0=80.83 shift1=85.89 (was 85.89 / 84.66)
```

Attach **GrokDevOrderRsiExport** EA on XAUUSD chart (Algo Trading ON) to cross-check; publisher uses `mt5_iRSI` when export file is fresh.

**Operator action:** Restart **python-order-rsi** and **backend** after pull.

---

## 2026-06-28 — Order RSI aligned with MT5 terminal (history + shift 1)

### Symptom

Order RSI values on the dashboard did not match the MT5 terminal RSI panel — often by several points on M5/H4.

### Root cause

1. **Bar shift mismatch** — App showed RSI on the **forming bar (shift 0)** only; MT5 Data Window commonly shows the **last completed bar (shift 1)**.
2. **Short Wilder warm-up** — Publisher fetched only **44 bars** (`period + 30`); MT5 RSI uses full chart history, causing ~0.2–1.6 pt drift even on the same bar.

Price source (bid vs last) was not the issue on this broker (`chart_mode=BID`, `tick.last=0`).

### Changes

| Area | Change | Why |
|------|--------|-----|
| `order_rsi_service.py` | Fetch **5000 bars** (`ORDER_RSI_HISTORY_BARS`); emit `completed` block with shift-1 RSI | Match MT5 Wilder state; expose both shifts |
| `rsi_util.py` | `wilder_rsi_forming_and_completed()` | Shared shift 0 / shift 1 helper |
| `config.py` | `ORDER_RSI_HISTORY_BARS` env (default 5000) | Tunable warm-up depth |
| `order-rsi.component.ts` | Show **Bar 0 · forming** and **Bar 1 · MT5 Data Window** per TF | Side-by-side terminal comparison |
| `order-rsi-stream.service.ts` | Types for `completed`, `historyBars` | Typed API payload |
| Docs | `api-endpoints.md`, `setup-and-run.md`, `python/mt5_xauusd/README.md`, `CHANGELOG.md` | Operator + dev reference |

### Verification

- `pytest tests/test_rsi_util.py` — pass.
- `npm run build` — pass.
- Live M1: 44-bar vs 5000-bar forming RSI delta &lt; 0.3 pt; shift 0 vs shift 1 delta ~1–7 pt (expected).

**Operator action:** Restart **python-order-rsi** in Stack Pilot to pick up the publisher change.

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

## 2026-06-28 — Order RSI live panel (W1→M1, forming bar)

### Symptom

Trader needed multi-timeframe RSI on the **current forming candle** (shift 0) with live price and broker/NY/IST times — not available in Analysis storm scanner (single TF, completed bars only).

### Implementation

| Layer | Change |
|-------|--------|
| Python `run_order_rsi.py` | MT5 tick/poll publisher → `grok_dev.live_order_rsi` JSON snapshot |
| Backend | `GET /order-rsi` + SSE `/order-rsi/stream` (250ms DB poll, push on change) |
| Frontend | Bottom nav **Order RSI** page + `OrderRsiStreamService` |
| Config | `ORDER_RSI_MODE=tick\|poll`, `ORDER_RSI_TICK_MS`, `ORDER_RSI_POLL_MS` |
| Stack Pilot | Service **`python-order-rsi`** in `E:\Source\stack-pilot` (`run_order_rsi.py`, log `logs/order-rsi.log`) |

RSI uses Wilder(14) on MT5 bars including forming bar; price = forming **close** updated from tick.

---

## 2026-06-28 — Frontend `Application bundle generation failed` (Stack Pilot logs)

### Symptom

Stack Pilot `logs/frontend.log` showed repeated **`Application bundle generation failed`** during `ng serve` hot reload (64 failures in the session). Latest successful build still emitted **NG8107** warnings on the Order RSI page on every rebuild.

Representative log lines (read bottom-up in `E:\Source\stack-pilot\logs\frontend.log`):

```
Application bundle generation failed.
X [ERROR] TS2300: Duplicate identifier 'OnDestroy'.  market.component.ts:348
X [ERROR] NG1: Object is possibly 'null'.  overview.component.ts (priceChange)
X [ERROR] NG9: Property 'onTimeframeChange' does not exist on type 'VolatilityComponent'.
X [ERROR] TS2300: Duplicate identifier 'formatWallTime'.  volatility.component.ts:268
X [ERROR] TS2304: Cannot find name 'FormsModule' / 'HttpClient'.  volatility.component.ts
X [ERROR] NG9: Property 'fillDemoCredentials' does not exist on type 'LoginComponent'.
▲ [WARNING] NG8107: unnecessary ?. on snapshot.asOf  order-rsi.component.ts:38-40
```

### Root cause

Iterative UI work under **`strictTemplates: true`** left transient TypeScript/template errors that blocked esbuild:

| Error | Cause |
|-------|--------|
| Duplicate `OnDestroy` | Second `import { OnDestroy }` appended mid-file in `market.component.ts` while already imported on line 1 |
| `priceChange` possibly null | Strict template checks on `overview.component.ts` without null guards |
| Missing `onTimeframeChange` | Template wired before method existed on `VolatilityComponent` |
| Duplicate `formatWallTime` | Class property **and** local method with the same name in `volatility.component.ts` |
| Missing `FormsModule` / `HttpClient` | Imports removed or incomplete during volatility refactor |
| Missing `fillDemoCredentials` | Login template button added before method was implemented |
| NG8107 on Order RSI | `OrderRsiSnapshot.asOf` is required in the type, but template used `snapshot.asOf?.broker` inside `*ngIf="snapshot"` |

### Changes

| File | Fix |
|------|-----|
| `market.component.ts` | Removed duplicate `OnDestroy` import (already on line 1) |
| `overview.component.ts` | Null-safe `priceChange != null && …` in template bindings |
| `volatility.component.ts` | Added `onTimeframeChange`; single `formatWallTime` from `time.util`; restored `FormsModule` / `HttpClient` imports |
| `login.component.ts` | Implemented `fillDemoCredentials()` for demo button + dev auto-login |
| `order-rsi.component.ts` | Use `snapshot.asOf.broker` / `.ny` / `.ist` (required field); `rowFor(tf)?.time.ny` |

### Verification

```powershell
cd frontend
npm run build
# Application bundle generation complete — no ERROR lines, no NG8107 warnings
```

Stack Pilot frontend log after fix should show **`Application bundle generation complete`** without preceding `failed` blocks on Order RSI edits.

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
