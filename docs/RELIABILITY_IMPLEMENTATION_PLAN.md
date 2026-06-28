# Reliability & Production Readiness — Implementation Plan

Cross-stack plan to harden the Grok Dev data pipeline, backend security, and frontend data layer.

**Status:** Implemented (2026-06-28)

---

## Phase 1 — Data trust (Python + backend security)

| ID | Task | Layer | Status |
|----|------|-------|--------|
| R1 | Fix `--poll-seconds` default → enable per-TF intervals | Python | [x] |
| R2 | Postgres `pool_pre_ping` + retry on upsert/read | Python | [x] |
| R3 | `sync_status` in one-shot downloads + daemon liveness touch | Python | [x] |
| R4 | Unified logging bootstrap; `DEBUG` from env | Python | [x] |
| R5 | pytest for candle filter + poll scheduling | Python | [x] |
| R6 | Spring profiles (`dev` / `prod`); env-based secrets | Backend | [x] |
| R7 | `@Profile("dev")` on `DataSeeder` | Backend | [x] |
| R8 | JWT filter: try/catch + query token scoped to SSE only | Backend | [x] |
| R9 | `GlobalExceptionHandler` + consistent error JSON | Backend | [x] |
| R10 | `JwtUtil.validateToken` handles expired tokens safely | Backend | [x] |
| R11 | Shared health SSE scheduler + cached snapshot | Backend | [x] |

---

## Phase 2 — Frontend consistency

| ID | Task | Layer | Status |
|----|------|-------|--------|
| R12 | `fetchGridWithFallback` on market cache service | Frontend | [x] |
| R13 | Volatility + Analysis use unified grid fetch + offline | Frontend | [x] |
| R14 | Volatility mobile cards → CDK virtual scroll | Frontend | [x] |
| R15 | Production `fileReplacements` for `environment.prod.ts` | Frontend | [x] |
| R16 | E2E: authenticated dashboard smoke tests | Frontend | [x] |

---

## Phase 3 — Documentation sync

| ID | Task | Status |
|----|------|--------|
| R17 | Update Python README + INTEGRATION | [x] |
| R18 | Update `SPRINGBOOT_BACKEND.md`, `api-endpoints.md` | [x] |
| R19 | Update `ANGULAR_FRONTEND.md`, `DATA_FLOW_AND_INTEGRATION.md` | [x] |
| R20 | Update root `README.md`, `CHANGELOG.md` | [x] |

---

## Verification

```powershell
cd python && pytest tests/ -q
cd backend && mvn test
cd frontend && npm run build && npm run e2e
```

**Daemon poll check:** `python -m mt5_xauusd.main --daemon` should log per-TF intervals (M1:15s … D1:1800s), not uniform 45s.

---

## Key files

| Area | Files |
|------|-------|
| Python poll fix | `mt5_xauusd/main.py`, `data_downloader.py` |
| Python resilience | `postgres_client.py`, `candle_util.py`, `config.py` |
| Python tests | `python/tests/test_candle_util.py` |
| Backend profiles | `application.properties`, `application-dev.properties`, `application-prod.properties` |
| Backend security | `JwtAuthenticationFilter.java`, `SecurityConfig.java`, `DataSeeder.java` |
| Backend health SSE | `HealthStreamScheduler.java`, `HealthSnapshotService.java` |
| Frontend data | `market-data-cache.service.ts`, `volatility.component.ts`, `analysis.component.ts` |
| E2E | `e2e/dashboard.spec.ts`, `e2e/auth.helpers.ts` |
