# Database Schema (grok_dev)

## Tables

### users
| Column      | Type         | Constraints          |
|-------------|--------------|----------------------|
| id          | SERIAL       | PK                   |
| username    | VARCHAR(50)  | UNIQUE, NOT NULL     |
| password    | VARCHAR(100) | NOT NULL (BCrypt)    |
| enabled     | BOOLEAN      | DEFAULT true         |
| created_at  | TIMESTAMP    | DEFAULT now()        |

### roles
| Column | Type        | Constraints |
|--------|-------------|-------------|
| id     | SERIAL      | PK          |
| name   | VARCHAR(50) | UNIQUE      |

### user_roles
Join table (many-to-many)
| Column  | Type   |
|---------|--------|
| user_id | BIGINT (FK) |
| role_id | BIGINT (FK) |

### projects
Demo content table
| Column      | Type         | Notes               |
|-------------|--------------|---------------------|
| id          | SERIAL       | PK                  |
| title       | VARCHAR(100) | NOT NULL            |
| description | TEXT         |                     |
| status      | VARCHAR(20)  | DEFAULT 'ACTIVE'    |
| created_by  | BIGINT       | FK → users          |
| created_at  | TIMESTAMP    |                     |

## Initial Data
- admin (ROLE_ADMIN)
- user1 (ROLE_USER)
- 3 sample projects

## Connection
Configured via `application.properties`:
```
spring.jpa.properties.hibernate.default_schema=grok_dev
spring.datasource.url=jdbc:postgresql://localhost:5432/postgres
```

`ddl-auto=update` will create tables on startup.

## MT5 Market Data Tables (XAUUSD)

Populated by Python downloader in `python/mt5_xauusd/`.

Tables (in `grok_dev` schema):
- `XAUUSD_D1`
- `XAUUSD_H4`
- `XAUUSD_H1`
- `XAUUSD_M15`
- `XAUUSD_M5`
- `XAUUSD_M1`

Plus observability:
- `sync_status` (timeframe PK, last_candle_time, last_synced)

All XAUUSD_* share this structure:

| Column      | Type      | Description             |
|-------------|-----------|-------------------------|
| time        | TIMESTAMP | Primary key (bar time)  |
| open        | NUMERIC   |                         |
| high        | NUMERIC   |                         |
| low         | NUMERIC   |                         |
| close       | NUMERIC   |                         |
| tick_volume | BIGINT    | MT5 tick volume         |
| spread      | INTEGER   |                         |
| real_volume | BIGINT    | MT5 real volume         |

Inserts use ON CONFLICT on `time` for safe incremental updates.

Tables are created automatically by the Python downloader on first use for each timeframe (using SQLAlchemy with extend_existing to support safe re-registration).

### sync_status
| Column         | Type      | Notes                     |
|----------------|-----------|---------------------------|
| timeframe      | VARCHAR   | PK (D1, H4, ...)          |
| last_candle_time | TIMESTAMP | Latest completed bar time |
| last_synced    | TIMESTAMP | When Python last updated  |

See root [CHANGELOG.md](../CHANGELOG.md) for application change logs.