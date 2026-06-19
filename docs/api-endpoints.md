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

Returns the most recent completed candles (DESC by time - newest first) including **RSI(14)** (calculated server-side using 14-period Wilder smoothing) for the data grid view.

Supports `limit`.

The Data Grid in the UI uses this endpoint. Data is sorted descending by time.

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

Powers the dedicated Angular Health Dashboard.

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