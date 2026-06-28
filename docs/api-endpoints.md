# API Endpoints

Base URL: `http://localhost:8081` (port may vary if auto-selected by run script)

## Authentication (JWT + Refresh Tokens)

### POST `/api/auth/login`
**Request:**
```json
{
  "username": "admin",
  "password": "admin123"

Note: The admin user is automatically created on first startup by DataSeeder.java if it does not exist.
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-refresh-token-here",
  "tokenType": "Bearer",
  "username": "admin",
  "message": "Login successful"
}
```

### POST `/api/auth/refresh`
Refresh the access token using refresh token.

## Market Data (MT5 XAUUSD)

Data is populated by the Python MT5 downloader into the `grok_dev` schema.

### GET `/api/market/xauusd/{timeframe}`

Supported timeframes: `D1`, `H4`, `H1`, `M15`, `M5`, `M1`

**Query Params:**
- `from` (optional, ISO datetime)
- `to` (optional, ISO datetime)
- `limit` (default 500, max recommended 10000)

**Example:**
```
GET /api/market/xauusd/D1?from=2025-01-01T00:00&limit=100
```

**Response:** Data is returned in descending order by time (newest first).
```json
[
  {
    "time": "2025-06-18T00:00:00",
    "open": 2650.45,
    "high": 2675.10,
    "low": 2648.20,
    "close": 2672.55,
    "tickVolume": 12345,
    "spread": 15,
    "realVolume": 0,
    "rsi": 62.5
  }
]
```

### GET `/api/market/xauusd/{timeframe}/latest`

Quick latest N candles (default 200).

### GET `/api/market/xauusd/{timeframe}/grid`

Returns the most recent completed candles (DESC by time - newest first) including:

- **RSI(14)** (server-side Wilder)
- Timezone columns for the Data Grid:
  - `time` – Broker / MT5 server time
  - `nyTime` – New York (America/New_York)
  - `istTime` – Indian (Asia/Kolkata)

The stored 'time' is broker/MT5 server wall time. Converted using configured `grok.market.broker-server-zone` (default UTC) via server zone → instant → target zones. This makes NY session filtering and IST/NY wall times accurate regardless of broker offset (e.g. GMT+2 / GMT+3 common). For a NY 08:00 (EDT) open, IST is 17:30 (5:30 PM) same day in summer.

Query params:
- `limit` (default 200)
- `ny_session_only` (default false): when true, only NY session bars (common 08:00-17:00 NY time) are returned; non-NY omitted. For D1, OHLC is aggregated from NY session only (synthetic daily using M15 bars with nyTime in session window; representative time = first session bar's broker time). RSI calculated only on the filtered/aggregated series. Affects Data Grid tab only. Note: D1 ny results are limited by available recent M15 history (deeper history requires sufficient M15 rows stored).

Supports `limit`.

The Data Grid tab uses this endpoint (toggle "NY Session Only" next to TF selector). Data is sorted descending by time. Existing full data when off.

### GET `/api/market/xauusd/sync-status`

Returns map of timeframe → {timeframe, lastCandleTime, lastSynced} (from Python daemon's `sync_status`).

Useful for observability / custom clients. UI primarily uses `/health`.

### GET `/api/market/xauusd/health`

Returns:
```json
{
  "status": "UP" | "DEGRADED" | "DOWN",
  "freshCount": 5,
  "total": 6,
  "details": {
    "D1": { "lastCandleTime": "...", "lastSynced": "...", "fresh": true },
    ...
  },
  "checkedAt": "2026-06-19T..."
}
```

Uses real per-TF freshness thresholds (see MarketDataService).

- **`lastCandleTime`** comes from `sync_status.last_candle_time`. If null, the backend falls back to `MAX(time)` from `grok_dev.XAUUSD_{TF}` and sets `details[TF].source = "table_max"`.
- **`touch_sync_status`** (Python daemon liveness) now also backfills `last_candle_time` from stored candles when no new bars arrive.
- **`freshCount`** may be 0 when candles exist but are older than thresholds (status `DOWN`/`DEGRADED`) — cards show **STALE** with last candle date, not **NO DATA**.

Powers the dedicated Angular Health Dashboard. The dashboard shell also subscribes to the SSE stream below for push alerts.

### GET `/api/market/xauusd/health/stream`

Server-Sent Events stream (`text/event-stream`). Emits a `health` event every 30 seconds with the same JSON shape as `/health`.

Requires Bearer token **or** `?access_token=<jwt>` (EventSource cannot send Authorization headers).

Example client URL: `/api/market/xauusd/health/stream?access_token=eyJ...`

### GET `/api/market/xauusd/order-rsi`

Live **Order RSI** snapshot — Wilder RSI(14) on **close**, with both MT5 bar shifts:

| Field | Meaning |
|-------|---------|
| `timeframes.{TF}.rsi` | Python Wilder — **shift 0** (forming) |
| `timeframes.{TF}.completed.rsi` | Python Wilder — **shift 1** (last closed) |
| `timeframes.{TF}.mt5.shift0.rsi` | MT5 built-in `iRSI` shift 0 (when EA export fresh) |
| `timeframes.{TF}.mt5.shift1.rsi` | MT5 built-in `iRSI` shift 1 |
| `mt5ExportAvailable` | `true` when `GrokDevOrderRsiExport.mq5` JSON is fresh |
| `timeframes.{TF}.historyBars` | Bars used for Wilder warm-up (default **5000**) |
| `timeframes.{TF}.sr` | Classic floor pivots from **Bar 0** H/L/C (`s3`…`r3`, `pivot`) |
| `timeframes.{TF}.completed.sr` | Classic floor pivots from **Bar 1** H/L/C |
| `timeframes.{TF}.open` | Bar 0 (forming) **open** |
| `timeframes.{TF}.gannBar1` | Gann So9 from **Bar 1 close** pivot |
| `timeframes.{TF}.gannBar0` | Gann So9 from **Bar 0 open** pivot (`available: false` when open missing) |

Frontend **Analyzer**: RSI/S/R table + two Gann grids (Bar 1 / Bar 0), each with **Odd Sq** / **Even Sq** toggles; shared **Pivot** row when either is on.

```json
{
  "symbol": "XAUUSD",
  "live": true,
  "mt5ExportAvailable": true,
  "price": 4188.67,
  "timeframes": {
    "M5": {
      "rsi": 72.82,
      "sr": { "s3": 4198.44, "s2": 4192.01, "s1": 4188.56, "pivot": 4185.33, "r1": 4182.10, "r2": 4178.45, "r3": 4170.12 },
      "completed": {
        "rsi": 65.86,
        "sr": { "s3": 4193.00, "s2": 4187.50, "s1": 4183.80, "pivot": 4180.00, "r1": 4176.20, "r2": 4172.50, "r3": 4165.00 }
      },
      "mt5": {
        "available": true,
        "shift0": { "rsi": 72.82 },
        "shift1": { "rsi": 65.86 }
      },
      "historyBars": 5000,
      "open": 4182.50,
      "gannBar1": {
        "available": true,
        "pivot": 4180.00,
        "pivotSource": "bar1_close",
        "oddSquare": { "above": [4289.55, 4401.02], "below": [4073.12, 3970.44] },
        "nextOddAbove": 4289.55
      },
      "gannBar0": {
        "available": true,
        "pivot": 4182.50,
        "pivotSource": "bar0_open",
        "oddSquare": { "above": [4292.10], "below": [4075.00] }
      }
    }
  }
}
```

Requires Python publisher: `python run_order_rsi.py` (writes `grok_dev.live_order_rsi`).

Timeframes: **W1, D1, H4, H1, M15, M5, M1** — all read live from MT5 (W1 is not stored in historical sync tables).

**MT5 alignment:** Terminal RSI **14 / Close**. Match **Bar 1** → Data Window bar index 1; **Bar 0** → bar index 0. See [order-rsi-mt5-alignment.md](./order-rsi-mt5-alignment.md).

**UI:** **Analyzer** — TF-column RSI/S/R table + **Gann Odd Square** block below; zone-colored RSI; **B0SR** / **B1SR** / **Odd Sq** / **Even Sq** row toggles; page RSI source toggle (**Calculated** vs **MT5 built-in**).

Python env:

| Variable | Default | Meaning |
|----------|---------|---------|
| `ORDER_RSI_HISTORY_BARS` | `5000` | Bars per TF for Wilder warm-up |
| `ORDER_RSI_RSI_PERIOD` | `14` | RSI period |
| `BROKER_SERVER_ZONE` | `Etc/GMT-3` | OctaFX server time for bar labels |

### GET `/api/market/xauusd/order-rsi/stream`

Server-Sent Events (`text/event-stream`). Emits `orderRsi` events whenever the Postgres snapshot changes (backend polls every `grok.order-rsi.stream-poll-ms`, default 250ms).

Requires Bearer token **or** `?access_token=<jwt>`.

Python push modes (env):

| Variable | Default | Meaning |
|----------|---------|---------|
| `ORDER_RSI_MODE` | `tick` | Push when tick price changes |
| `ORDER_RSI_MODE` | `poll` | Push every `ORDER_RSI_POLL_MS` |
| `ORDER_RSI_TICK_MS` | `250` | Tick check interval |
| `ORDER_RSI_POLL_MS` | `1000` | Poll / heartbeat interval |

## Other Endpoints

### GET `/api/welcome`
Public demo endpoint.

### GET `/api/projects/active`
Returns active projects (demo data).

**Request:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-access-jwt",
  "tokenType": "Bearer"
}
```

### GET `/api/auth/preferences`
Get saved column visibility/order + health TF visibility (JSON).

Requires Bearer.

### PUT `/api/auth/preferences`
Replace entire preferences blob: `{ "preferences": "{\"grid\": {...}, \"market\": {...}}" }`

### PATCH `/api/auth/preferences`
Deep-merge partial preferences (preferred): `{ "preferences": "{\"grid\": {\"D1\": {...}}}" }`

**Response:**
```json
{
  "message": "Preferences merged",
  "preferences": "{ ... merged full JSON ... }"
}
```

Requires Bearer token **or** `?access_token=<jwt>` on the SSE stream path only (EventSource limitation).

**CORS:** Backend allows explicit origins from `grok.cors.allowed-origins` (default `http://localhost:4200`). Set in `application.properties` or env for production.

### Spring profiles

| Profile | When |
|---------|------|
| `dev` (default) | Local development; runs `DataSeeder`, verbose logs |
| `prod` | Deployment; set `JWT_SECRET`, `DB_URL`, `DB_USER`, `DB_PASSWORD` |

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"
mvn spring-boot:run
```

### GET `/api/auth/me`
Requires Bearer access token.

**Response:**
```json
{
  "username": "admin",
  "authenticated": true
}
```

### POST `/api/auth/logout`
Revokes the user's refresh token.

## Welcome & Content

### GET `/api/welcome`
**Response:**
```json
{
  "message": "Welcome to Grok Dev!",
  "description": "...",
  "status": "success"
}
```

### GET `/api/projects`
Returns list of demo projects.

### GET `/api/projects/active`

## Protected Routes
All non-auth endpoints require valid JWT in header:
```
Authorization: Bearer <token>
```

## Error Responses
- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Validation errors

## Frontend Integration
Angular uses `AuthInterceptor` to automatically attach the token to all outgoing requests after login.

See root [CHANGELOG.md](../CHANGELOG.md) for application-wide change logs (maintained for every update).