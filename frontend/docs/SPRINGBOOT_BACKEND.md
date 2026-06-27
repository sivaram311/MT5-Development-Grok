# Spring Boot Backend — Deep Technical Documentation

## Key Technologies
- Spring Boot 3
- JdbcTemplate (deliberate choice for market data tables)
- Spring Security + JWT (stateless authentication)
- No full JPA entities for the dynamically queried `XAUUSD_*` tables

## Why JdbcTemplate for Market Data?

The six timeframe tables have identical structure but are named dynamically (`XAUUSD_D1`, `XAUUSD_H4`, etc.). Using standard `@Entity` classes and Spring Data JPA Repositories would require complex dynamic schema mapping. Raw `JdbcTemplate` queries give us full control over SQL string building, performance tuning, and explicit column mapping.

## The Brain: [MarketDataService](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java)

### getXauusdGridData (Most Important Business Logic)

```java
public List<XauusdCandle> getXauusdGridData(String timeframe, int limit, boolean nySessionOnly)
```

Flow when `nySessionOnly = true` and `timeframe = "D1"`:

1. Fetch recent `M15` data from the database (using a large multiplier so we have enough history to construct N daily candles).
2. Reverse the resulting list to chronological (ascending) order.
3. Filter out bars whose America/New_York local hour is outside the `08:00` to `16:59` window (kept bars: `hour >= 8 && hour < 17`).
4. Group the remaining `M15` bars by their New York calendar date (`nyTime.toLocalDate()`).
5. For each group (representing one New York trading day), create one synthetic daily candle:
   - `time` = broker server wall-clock time of the first `M15` bar in the NY window (usually corresponds to the `08:00` NY open).
   - `open` = open price of the first bar.
   - `high` = maximum high price observed across the group.
   - `low` = minimum low price observed across the group.
   - `close` = close price of the last bar in the group.
   - `volume` = sum of tick volumes across the group.
6. Re-enrich the synthetic daily rows (to compute correct display times like `nyTime` and `istTime`).
7. Run RSI(14) Wilder calculation strictly across this synthetic daily series.
8. Return only the requested number of newest rows in descending order (newest first).

This guarantees that the Daily New York Session Only view calculates OHLC and RSI purely from trading that occurred inside the New York hours.

### Timezone Handling (Recent Major Fix)

Controlled by the configuration property `grok.market.broker-server-zone` in [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties):

```properties
grok.market.broker-server-zone=UTC   # or GMT+3, GMT+2, etc. depending on broker MT5 server time
```

Code implementation in [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java):
```java
ZonedDateTime serverZdt = brokerWallTime.atZone(serverZone);
nyTime  = serverZdt.withZoneSameInstant(nyZone).toLocalDateTime();
istTime = serverZdt.withZoneSameInstant(istZone).toLocalDateTime();
```

This ensures that `08:00` NY (EDT) correctly maps to `17:30` IST (5:30 PM India time) during summer, resolving the timezone display shifts.

## Health & Freshness System

Real freshness age thresholds are evaluated inside `isFreshForTimeframe` on the backend:

- `D1` : < 25 hours
- `H4` : < 4.5 hours
- `H1` : < 70 minutes
- `M15`: < 20 minutes
- `M5` : < 7 minutes
- `M1` : < 2 minutes

The `/health` endpoint returns the aggregate pipeline status (`UP`, `DEGRADED`, `DOWN`), a count of fresh timeframes, and a detail map containing each timeframe's `lastCandleTime`, `lastSynced` timestamp, and `fresh` status.

### Health SSE Stream (Push Notifications)

[HealthStreamController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/HealthStreamController.java) exposes:

- `GET /api/market/xauusd/health/stream` — `text/event-stream`, polls health every 30 seconds
- Event name: `health` — JSON payload matches the `/health` response shape
- Requires authentication (Bearer header or `?access_token=` query param for EventSource clients)

The Angular dashboard subscribes on login and shows a banner when status transitions to `DEGRADED` or `DOWN`.

## Endpoints Used by Angular

The frontend communicates with the backend via the following APIs:

### Market & Health Endpoints
- `GET /api/market/xauusd/{tf}/grid?limit=500&ny_session_only=...` — Fetches candles from [MarketDataController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/MarketDataController.java).
- `GET /api/market/xauusd/health` — Fetches real-time status and freshness details.
- `GET /api/market/xauusd/health/stream` — SSE push stream (30s interval) for pipeline status changes.
- `GET /api/market/xauusd/sync-status` — Returns raw MT5 sync information.

### Auth & User Preferences Endpoints
- `POST /api/auth/login` — Authentication endpoint in [AuthController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/AuthController.java). Returns access and refresh JWTs.
- `POST /api/auth/refresh` — Refreshes expired access tokens.
- `GET /api/auth/preferences` — Loads the current user's column ordering and visibility configurations.
- `PUT /api/auth/preferences` — Replaces the entire preferences JSON string (legacy full save).
- `PATCH /api/auth/preferences` — Deep-merges a partial JSON patch into stored preferences via [UserService.mergeColumnPreferences](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/UserService.java). Preferred by the Angular frontend to avoid overwriting unrelated sections.

## Authentication Flow

1. **Login**: User authenticates via [AuthController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/AuthController.java) using BCrypt. A JWT access token (24-hour lifetime) and refresh token (7-day lifetime) are generated.
2. **Angular Storage**: Tokens are stored securely in the browser's local storage.
3. **Interceptor**: The Angular interceptor [auth.interceptor.ts](file:///E:/Source/grok_dev/frontend/src/app/interceptors/auth.interceptor.ts) automatically adds `Authorization: Bearer <token>` to request headers.
4. **Validation**: The backend filter [JwtAuthenticationFilter.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/security/JwtAuthenticationFilter.java) validates the JWT on every protected request. Also accepts `access_token` query parameter for SSE streams.
5. **Token Refresh**: If the access token is expiring soon (less than 5 minutes) or a `401 Unauthorized` is returned, a refresh request is automatically made to get a new access token.

## CORS Configuration

CORS is configured globally in [SecurityConfig.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/config/SecurityConfig.java) using origin pattern matching:
```java
configuration.setAllowedOriginPatterns(Arrays.asList("*"));
configuration.setAllowCredentials(true);
```
Controller classes use the `@CrossOrigin` annotation without parameters (defaulting to allow all origins), permitting requests from any client host name, LAN IP, or public IP address.

## Production Considerations (Pending Tasks)

- Move JWT secrets and database credentials to secure environment variables.
- Configure proper API rate limiting (e.g. Bucket4j).
- Enable HTTPS (SSL/TLS termination).
- Fine-tune connection pool properties for JDBC operations.