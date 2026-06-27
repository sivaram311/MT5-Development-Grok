# NY Session Only Feature — Complete Specification & Implementation

## Business Requirement

When the trader enables the "NY Session Only" filter on the dashboard, they want to view **only** the portion of the market that occurred during the New York trading window (08:00 – 17:00 local NY time), satisfying these conditions:

1. **Continuous Sequence**: Non-NY periods are completely omitted from the grid so that no gaps or empty night sessions are shown.
2. **Intraday Timeframes (M1–H4)**: Simply filters out database rows falling outside the NY local window.
3. **Daily Timeframe (D1)**: Since a standard daily bar mixes London, Tokyo, and New York trading sessions, we cannot simply filter daily rows. Instead, the daily bar must be reconstructed entirely from finer-grained intraday candles (`M15` data) that occurred within the NY local session.
4. **Indicator Recalculation**: The Wilder's RSI(14) calculation must be executed strictly across the resulting filtered sequence, not the unfiltered database sequence.

## Definition of NY Session Window

- **Timezone**: `America/New_York`
- **Session Range**: `hour >= 8 && hour < 17` (covers `08:00` to `16:45` inclusive for `M15` data)
- **Duration**: 9 hours of trading action per day.

This validation is implemented in the method `isInNySession()` of [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java).

## Backend Implementation

The selection and processing is triggered in the data controller [MarketDataController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/MarketDataController.java) and executed in [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java).

### Non-D1 Timeframe Path (M1, M5, M15, H1, H4)
For standard intraday queries, the backend:
1. Fetches the raw table candles.
2. Localizes their timestamps via `enrichTimezoneFields()`.
3. Filters the list to keep only elements where `isInNySession()` returns `true`.
4. Calculates RSI on the remaining series.

### D1 Timeframe Path (Special Reconstruct Mode)
When D1 is requested with `nySessionOnly = true`:
1. **Fetch Depth**: Instead of querying `XAUUSD_D1`, the backend fetches a large quantity of recent `M15` records from the `XAUUSD_M15` database table.
2. **Translate & Filter**: It converts the database server wall clock to NY time using the configured timezone from [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties) and keeps only bars where `isInNySession()` is `true`.
3. **Daily Aggregation**: It executes `aggregateNySessionToDaily()`, which:
   - Groups the filtered `M15` candles by their New York calendar date (`nyTime.toLocalDate()`).
   - For each date's sorted group, maps:
     - `open` = open price of the first `M15` bar in the window.
     - `high` = maximum high price observed across the group.
     - `low` = minimum low price observed across the group.
     - `close` = close price of the last `M15` bar in the window.
     - `tickVolume` = sum of tick volumes.
     - `time` = first `M15` bar's broker server timestamp.
4. **Time Enrichment**: Runs `enrichTimezoneFields()` on the newly built daily candles so that displayed Broker, NY, and IST times match the session start.
5. **RSI Calculation**: Runs `calculateRSI()` on the synthetic daily close series.

As a result of this aggregation:
- `spread` and `realVolume` are returned as `null`.
- The broker `time` column will match the time when the NY session opened (e.g. `12:00` or `15:00` broker time instead of the traditional midnight `00:00` timestamp).

## Frontend Integration

The Angular frontend grid in [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts):
- Passes the parameter `&ny_session_only=true` or `false` dynamically in its API query.
- Renders dates using the local-timezone-safe `formatWallTime()` method.
- Updates the grid view immediately on user toggle.

## Example Conversion (Summer / EDT Active)

For a New York trading day:
- **Broker Server (UTC)**: `2026-06-18 12:00:00`
- **New York Time (EDT)**: `2026-06-18 08:00:00`
- **Indian Time (IST)**: `2026-06-18 17:30:00` (5:30 PM IST)

This confirms the correct mapping. In regular mode, the day's bar is stamped at broker midnight `00:00` (which resolves to `20:00` the previous day in NY time, outside of the NY session). When the NY filter is active, that midnight bar is removed, and the synthetic daily bar starting at NY `08:00` (broker `12:00`) takes its place.

## Related Code Locations

- **Controller Layer**: [MarketDataController.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/controller/MarketDataController.java)
- **Core Processing**: [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java)
- **User Dashboard**: [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts)
- **In-App Help**: [docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts) (`#ny`)