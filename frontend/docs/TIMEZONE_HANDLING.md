# Timezone Handling — Full Explanation

## The Fundamental Problem

MetaTrader 5 (MT5) reports bar timestamps according to the broker's server clock. 

A bar that "opened at 12:00" in MT5 might actually represent:
- `12:00 UTC`
- `12:00 GMT+3` (common for CySEC/European brokers)
- `12:00 GMT+2` (common winter offset)

For a single point in time, we need to resolve and display three different "wall clock" representations side-by-side in the UI:
1. **Broker Time**: the raw time stamped by MT5 (for chart correlation).
2. **New York Time**: America/New_York (critical for the NY session filter).
3. **Indian Standard Time (IST)**: Asia/Kolkata (for the target trader's local hours).

## Solution Architecture

```
 MT5 Server (e.g. GMT+3)
        ↓ (raw server wall-clock hours)
 Ingestion DB (stored as naive TIMESTAMP)
        ↓
 Spring Boot Backend (resolves instant via broker zone config)
   ├── nyTime (America/New_York ZDT wall time)
   └── istTime (Asia/Kolkata ZDT wall time)
        ↓ (naive local ISO string representation)
 Angular UI (displays digits directly, bypassing local browser offset shifting)
```

### 1. Ingestion & Storage (Python)
In the Python module [mt5_xauusd](file:///E:/Source/grok_dev/python/mt5_xauusd/), timestamps are collected from MT5 as integers (seconds since epoch) and converted to pandas datetime. They are saved in PostgreSQL as a **naive TIMESTAMP** (without timezone details). We preserve the exact wall clock digits reported by the broker.

### 2. Timezone Translation (Spring Boot)
The translation behavior is governed by the configuration property `grok.market.broker-server-zone` in [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties):

```properties
grok.market.broker-server-zone=UTC
# or GMT+3, GMT+2, Etc/GMT+2, etc.
```

In the Java class [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java), the method `enrichTimezoneFields()` uses this configuration:
```java
// Convert naive database timestamp to local date-time representing broker wall time
LocalDateTime brokerWallTime = candle.getTime();

// Associate with the configured broker server zone
ZonedDateTime serverZdt = brokerWallTime.atZone(serverZone);

// Shift instant to America/New_York and store as LocalDateTime
candle.setNyTime(serverZdt.withZoneSameInstant(nyZone).toLocalDateTime());

// Shift instant to Asia/Kolkata and store as LocalDateTime
candle.setIstTime(serverZdt.withZoneSameInstant(istZone).toLocalDateTime());
```

This properly handles daylight saving changes (DST transition periods) in New York, adjusting the hourly offsets dynamically.

### 3. Display Safety (Angular)
In the frontend, using a standard Angular date pipe or converting the local ISO string representation directly via `new Date("2026-06-18T17:30:00")` causes the browser engine to parse the string as local time of the user's computer. A trader viewing the page from a timezone outside of India would see the IST column shifted.

To guarantee that the exact backend calculated wall hours are displayed, [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts) uses a custom formatter, `formatWallTime()`, to parse the string representation directly:
```ts
formatWallTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  const s = dt.toString();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) {
    const d = new Date(m[1] + 'T00:00:00Z'); // UTC safe month lookup
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = m[1].slice(8, 10);
    return `${mon} ${day} ${m[2]}`;
  }
  return s;
}
```

## Practical Verification Example (Summer / EDT Active)

Suppose the broker server runs on GMT+3:
- The New York session opens at `08:00 EDT`.
- This is equivalent to `12:00 UTC` or `15:00 GMT+3` (broker server time).

Database entries will show:
- `time`: `2026-06-18 15:00:00`

With `grok.market.broker-server-zone=GMT+3` configured:
- `nyTime` will evaluate to `2026-06-18 08:00:00`
- `istTime` will evaluate to `2026-06-18 17:30:00` (5:30 PM IST)

If the configuration was incorrectly set to `UTC` (default), the translation would shift the calculations:
- `nyTime` becomes `11:00:00`
- `istTime` becomes `20:30:00`

Because the NY hour (`11:00`) still falls within the session filter range (`08:00–16:59`), the row would be displayed. However, rows corresponding to early NY morning trading (which actually occurred at `08:00` NY time) would register as `11:00` broker time. Without the proper configuration shift, those early bars would evaluate to `04:00` NY time and be incorrectly excluded by the filter.

## Related Code Locations

- **Backend Logic**: [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java) (`enrichTimezoneFields()`, `isInNySession()`, `aggregateNySessionToDaily()`)
- **Backend Configuration**: [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties) (`grok.market.broker-server-zone`)
- **Frontend Display**: [market.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/market.component.ts) (`formatWallTime()`)
- **In-App Interactive Document**: [docs.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/docs.component.ts) (`#time`, `#ny`)