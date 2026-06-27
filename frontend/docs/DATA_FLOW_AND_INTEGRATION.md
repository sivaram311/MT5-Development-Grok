# Data Flow and Integration Between Python, Spring Boot, and Angular

## The Single Source of Truth

The **PostgreSQL `grok_dev` database schema** is the single source of truth for the entire application. All other layers (Python, Spring Boot, Angular) interact with it directly or represent filtered/computed views of the records stored there.

## End-to-End Execution Flow

Here is the exact step-by-step lifecycle of XAUUSD candle data through the three layers of the project:

### 1. Data Ingestion (Background Python Daemon)
The sync process is orchestrated by the script [run_data_downloader.py](file:///E:/Source/grok_dev/python/run_data_downloader.py) and executed by [data_downloader.py](file:///E:/Source/grok_dev/python/mt5_xauusd/data_downloader.py):
1. **Fetch from MT5**: The Python daemon requests historical or recent candles from the MetaTrader 5 terminal via the low-level client [mt5_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/mt5_client.py).
2. **Candle Completion Check**: To prevent writing active bars that can still change, the last candle (index `-1`) is dropped:
   ```python
   df = df.iloc[:-1] if len(df) > 1 else df
   ```
3. **Database Write**: The database helper [postgres_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py) inserts the dataframe rows into the corresponding timeframe table (`XAUUSD_D1`, `XAUUSD_M15`, etc.) using an `ON CONFLICT DO NOTHING` statement on the `time` primary key.
4. **Sync Status Logging**: After writing a batch, the script updates the `sync_status` table with the latest candle timestamp.

### 2. API Retrieval (Spring Boot Backend)
When the user views the grid, the frontend calls the grid API endpoint exposed in [MarketDataController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/MarketDataController.java).

- **Standard Grid Query (`nySessionOnly = false`)**:
  1. The backend service [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java) queries the database for the N most recent rows from the requested timeframe table using `JdbcTemplate`.
  2. The database's naive timestamps are translated into NY local time and IST local time using the configurable broker offset defined in [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties).
  3. The list is reversed to chronological order, and the RSI(14) Wilder calculations are computed over the closing prices.
  4. The list is trimmed to the exact requested limit and returned to the client in descending order.

- **NY Session Only Grid Query (`nySessionOnly = true` & Timeframe `D1`)**:
  1. Instead of loading from `XAUUSD_D1`, the service queries a larger history of intraday `M15` data from `XAUUSD_M15`.
  2. The `M15` timestamps are converted to local New York times.
  3. It filters out all candles outside the `08:00–16:59` America/New_York window.
  4. The remaining candles are grouped by New York calendar date and aggregated to form daily candles.
  5. The timezone fields (Broker, NY, IST) are recalculated for the aggregated rows.
  6. The Wilder's RSI calculation is executed directly on the closing prices of the resulting daily series, and the newest rows are returned.

### 3. Frontend Render (Angular UI)
1. **Call APIs**: The component [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts) triggers the HTTP GET request with the appropriate timeframe, limit, and session flags.
2. **Safe Local Time Display**: The grid table avoids using native JavaScript `Date` pipes, which would parse strings in the browser's local timezone. Instead, it utilizes `formatWallTime()` to print the exact timezone digits calculated on the server.
3. **Interactive Control**: The user toggles the "NY Session Only" checkbox or switches the timeframe, triggering an immediate API refresh.

## Real-Time Health Monitoring

The system monitors data ingestion health continuously:
1. **Python Sync Timestamp**: The ingestion daemon writes the latest database write timestamp and synchronization runtime to the `sync_status` table.
2. **Backend Freshness Check**: The endpoint `/api/market/xauusd/health` queries `sync_status` and compares timestamps against age thresholds (e.g. D1 must be < 25 hours old, H1 < 70 minutes old).
3. **UI Dashboard Cards**: The page [health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts) fetches these status cards and renders them as colored indicators (`FRESH` vs. `STALE` or `NO DATA`) along with the exact time of the last candle.

## Timezone Configuration Mapping

To ensure accurate session mapping, the naive database timestamp must be matched with the broker's clock in the backend:

| Column | PostgreSQL Storage Type | Resolved in Java | Displayed in Angular |
| :--- | :--- | :--- | :--- |
| `time` | TIMESTAMP (Naive) | Associated with `grok.market.broker-server-zone` | Formatted directly as Broker Time |
| `nyTime` | (Calculated) | Translated to `America/New_York` | Displayed via `formatWallTime()` |
| `istTime` | (Calculated) | Translated to `Asia/Kolkata` | Displayed via `formatWallTime()` |

## Integration Point Summary

- **Python → Postgres**: Direct write access (the ingestion pipeline does not depend on Java or Node.js).
- **Spring Boot → Postgres**: Read access for market data, read/write access for user preferences and tokens.
- **Angular → Spring Boot**: Communicates via standard REST APIs; it has no direct database access.