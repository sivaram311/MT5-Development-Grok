# Technical Overview - Grok Dev Full Stack

This document details how the three independent platform layers (Python, Spring Boot, Angular) coordinate to fetch, process, and display XAUUSD market data.

## Core Value Proposition
The platform is designed to provide traders with a responsive, high-fidelity data workspace:
- **Multi-Timeframe grid**: Fast explorer switching across M1, M5, M15, H1, H4, and D1.
- **NY Session Only filter**: Toggles display to focus purely on America/New_York session hours (08:00 - 17:00).
- **Timezone side-by-side**: Resolves and displays Broker Server, New York, and Indian Standard Time (IST) hours.
- **Freshness Monitoring**: Live indication of pipeline health and sync heartbeats.
- **Mobile-First UX**: Responsive layouts designed for Realme P2 Pro (phone) and Realme Pad 2 (tablet).

---

## Three-Layer Architecture

```
[MetaTrader 5 Windows Client]
        ↓ (copy rates via mt5 python API)
[Ingestion Ingest Layer (Python)] ---> writes to ---> [Postgres Database]
                                                            ↓
[Angular Client App] <--- REST queries <--- [Spring Boot Web API Layer]
```

### Layer 1: Data Acquisition (Python Ingestion)
The code resides in [mt5_xauusd](file:///E:/Source/grok_dev/python/mt5_xauusd/):
- Connects directly to a running MetaTrader 5 terminal via the Python API client [mt5_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py).
- Extracts only completed candle periods, dropping active bars to prevent database revisions.
- Stores records in Postgres via [postgres_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py) using naive `TIMESTAMP` values matching the broker's server clock.
- Designed as a long-running daemon [run_data_downloader.py](file:///E:/Source/grok_dev/python/run_data_downloader.py) running on startup via Windows Task Scheduler.

### Layer 2: API & Intelligence (Spring Boot Backend)
The backend code resides in the Java project root:
- Direct database query execution via `JdbcTemplate` in [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java) to handle dynamically named timeframe tables.
- Implements timezone mapping (using the broker server timezone configured in [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties)), NY session filtering, synthetic D1 reconstruction, and server-side RSI Wilder smoothing.
- Exposes REST query services for market data grids, sync statistics, health audits, and user column preferences.

### Layer 3: Presentation (Angular Frontend)
The frontend code resides in the Angular project root:
- Built with standalone, lightweight components. Routes are lazy-loaded via [app.routes.ts](file:///E:/Source/grok_dev/frontend/src/app/app.routes.ts) inside [dashboard-layout.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/dashboard-layout.component.ts).
- Queries the backend `/grid` endpoints in [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts) to populate views.
- Bypasses local browser timezone conversion using a custom `formatWallTime()` parser to ensure correct display values.
- Implements responsive columns, slide-over drawer toggles, and live freshness monitoring [health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts).

---

## Architectural Contracts

1. **Time Integrity**: The database stores raw timestamps as naive values representing the broker server's wall time. Java associates these with the configured offset before converting to New York and Indian times.
2. **NY Session Boundaries**: America/New_York hour values must satisfy `hour >= 8 && hour < 17` to qualify.
3. **Synthetic D1 Generation**: When the NY session filter is toggled on, the backend skips the D1 database table and reconstructs daily bars from M15 data on the fly.
4. **RSI Calculation**: The Wilder's RSI indicator is computed server-side across the filtered series to ensure consistency.
5. **CORS and Security**: The backend controls access via stateless JWTs. Access tokens are proactively refreshed in [auth.interceptor.ts](file:///E:/Source/grok_dev/frontend/src/app/interceptors/auth.interceptor.ts).