# Database Schema

All tables live in the `grok_dev` PostgreSQL database schema.

## Market Data Tables

The following tables are dynamically created and verified on runtime by the Python ingestion module [mt5_xauusd](file:///E:/Source/grok_dev/python/mt5_xauusd/):

- `XAUUSD_D1`
- `XAUUSD_H4`
- `XAUUSD_H1`
- `XAUUSD_M15`
- `XAUUSD_M5`
- `XAUUSD_M1`

### Common Column Structure

Each of the timeframe tables shares an identical column layout:

| Column | PostgreSQL Type | Description | Key Notes |
| :--- | :--- | :--- | :--- |
| `time` | TIMESTAMP | Primary Key. Bar open time. | Naive timestamp (no timezone offset attached). Stored in broker wall-clock hours. |
| `open` | NUMERIC(12,5) | Open price. | |
| `high` | NUMERIC(12,5) | Maximum price observed. | |
| `low` | NUMERIC(12,5) | Minimum price observed. | |
| `close` | NUMERIC(12,5) | Close price. | |
| `tick_volume` | BIGINT | Volume of ticks inside the candle. | Primary indicator for volume. |
| `spread` | INTEGER | Spread at bar open. | Represented in points. |
| `real_volume` | BIGINT | Actual traded volume (if reported). | Typically `0` for XAUUSD forex feeds. |

*Storage contract*: The `time` field stores naive timestamps representing the **broker's server wall clock** directly. Timezone conversions and offsets are applied inside [MarketDataService.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/service/MarketDataService.java) dynamically when querying.

### Ingestion Logic
The Python client [postgres_client.py](file:///E:/Source/grok_dev/python/mt5_xauusd/postgres_client.py) performs inserts using SQLAlchemy's PostgreSQL dialect for conflict resolution:
```python
insert_stmt = pg_insert(table).values(row)
on_conflict_stmt = insert_stmt.on_conflict_do_nothing(index_elements=['time'])
```
This guarantees that synchronization runs are idempotent, safely skipping already-existing records.

---

## Ingestion Log Table

### `sync_status`
This table monitors runtime sync activity across the timeframes:

| Column | Type | Description |
| :--- | :--- | :--- |
| `timeframe` | VARCHAR | Primary Key. One of `D1`, `H4`, `H1`, `M15`, `M5`, `M1`. |
| `last_candle_time` | TIMESTAMP | The timestamp of the newest completed candle stored in the table. |
| `last_synced` | TIMESTAMP | The server system time when the Python script last wrote to this timeframe table. |

This table supports:
- Status summaries in the backend `/api/market/xauusd/health` and `/api/market/xauusd/sync-status`.
- Freshness status checks in the Angular component [health.component.ts](file:///E:/Source/grok_dev/frontend/src/app/dashboard/health.component.ts).

---

## Authentication & Authorization Tables

The backend includes Spring Security authorization tables:
- `users`: Stores usernames, emails, and hashed passwords. Includes the `column_preferences` column which holds the user's custom column order and visibility JSON.
- `roles`: Authority definitions (e.g. `ROLE_ADMIN`, `ROLE_USER`).
- `user_roles`: Many-to-many lookup table mapping users to roles.
- `projects`: Demo tables representing workspace projects.

These tables are created and seeded dynamically during backend initialization by [DataSeeder.java](file:///E:/Source/grok_dev/backend/src/main/java/com/grokdev/grokdev/config/DataSeeder.java).

## Schema Configuration Properties

Database mapping parameters are configured in the backend configuration file [application.properties](file:///E:/Source/grok_dev/backend/src/main/resources/application.properties):

```properties
spring.jpa.properties.hibernate.default_schema=grok_dev
spring.jpa.hibernate.ddl-auto=update
```
This forces Hibernate to direct standard entity mapping to the `grok_dev` schema and automatically update schemas on launch.