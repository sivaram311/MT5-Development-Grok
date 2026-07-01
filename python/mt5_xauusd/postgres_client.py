"""
PostgreSQL Client using SQLAlchemy
Handles connection and data insertion for XAUUSD tables in grok_dev schema.
"""

from sqlalchemy import create_engine, text, Table, Column, TIMESTAMP, Numeric, BigInteger, Integer, MetaData
from sqlalchemy.dialects.postgresql import insert
import pandas as pd
from typing import Dict, Callable, TypeVar
import logging
import time

from .config import DB_CONFIG, SCHEMA, get_table_name

logger = logging.getLogger(__name__)

T = TypeVar('T')


class PostgresClient:
    def __init__(self):
        self.engine = self._create_engine()
        self.metadata = MetaData(schema=SCHEMA)

    def _create_engine(self):
        url = (
            f"postgresql+psycopg2://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
            f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        )
        engine = create_engine(
            url,
            echo=False,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        return engine

    def _with_retry(self, operation: Callable[[], T], attempts: int = 3) -> T:
        last_error = None
        for attempt in range(1, attempts + 1):
            try:
                return operation()
            except Exception as exc:
                last_error = exc
                if attempt >= attempts:
                    break
                delay = 2 ** (attempt - 1)
                logger.warning(f"DB operation failed (attempt {attempt}/{attempts}): {exc}. Retrying in {delay}s…")
                time.sleep(delay)
        raise last_error

    def ensure_schema_exists(self):
        """Make sure the schema exists."""
        with self.engine.connect() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
            conn.commit()
        logger.info(f"Schema '{SCHEMA}' ensured.")

    def _get_table_definition(self, table_name: str):
        """Define table structure for XAUUSD data.
        Uses extend_existing=True so that calling this multiple times (e.g. upfront create + save_data)
        does not raise 'already defined' error on the same MetaData instance.
        """
        return Table(
            table_name,
            self.metadata,
            Column('time', TIMESTAMP, primary_key=True, nullable=False),
            Column('open', Numeric(12, 5)),
            Column('high', Numeric(12, 5)),
            Column('low', Numeric(12, 5)),
            Column('close', Numeric(12, 5)),
            Column('tick_volume', BigInteger),
            Column('spread', Integer),
            Column('real_volume', BigInteger),
            schema=SCHEMA,
            extend_existing=True
        )

    def create_table_if_not_exists(self, table_name: str):
        """Create table with proper schema if it doesn't exist."""
        table = self._get_table_definition(table_name)
        table.create(self.engine, checkfirst=True)
        logger.info(f"Table {SCHEMA}.{table_name} ready.")

    def ensure_sync_status_table(self):
        """Create sync_status table if it doesn't exist."""
        query = text(f'''
            CREATE TABLE IF NOT EXISTS "{SCHEMA}".sync_status (
                timeframe VARCHAR(10) PRIMARY KEY,
                last_synced TIMESTAMP,
                last_candle_time TIMESTAMP
            )
        ''')
        with self.engine.connect() as conn:
            conn.execute(query)
            conn.commit()

    def touch_sync_status(self, timeframe: str):
        """Update last_synced; backfill last_candle_time from stored candles when missing."""
        table_name = get_table_name(timeframe)
        last_candle = self.get_last_timestamp(table_name)
        if last_candle is not None:
            candle_ts = last_candle.to_pydatetime() if hasattr(last_candle, "to_pydatetime") else last_candle
            self.update_sync_status(timeframe, candle_ts)
            logger.debug("touch_sync_status(%s): backfilled last_candle_time=%s from table", timeframe, candle_ts)
            return

        query = text(f'''
            INSERT INTO "{SCHEMA}".sync_status (timeframe, last_synced, last_candle_time)
            VALUES (:tf, NOW(), NULL)
            ON CONFLICT (timeframe) DO UPDATE
            SET last_synced = NOW()
        ''')
        def _run():
            with self.engine.connect() as conn:
                conn.execute(query, {"tf": timeframe})
                conn.commit()
        self._with_retry(_run)
        logger.debug("touch_sync_status(%s): liveness only (no candles in table yet)", timeframe)

    def backfill_sync_status(self, timeframes: list):
        """Seed sync_status.last_candle_time from MAX(time) in each candle table."""
        for tf in timeframes:
            table_name = get_table_name(tf)
            last_candle = self.get_last_timestamp(table_name)
            if last_candle is not None:
                candle_ts = last_candle.to_pydatetime() if hasattr(last_candle, "to_pydatetime") else last_candle
                self.update_sync_status(tf, candle_ts)
                logger.info("Backfilled sync_status for %s → last_candle_time=%s", tf, candle_ts)
            else:
                self.touch_sync_status(tf)
                logger.info("No candles yet for %s; sync_status liveness row only", tf)

    def update_sync_status(self, timeframe: str, last_candle_time):
        """Update the last sync info for a timeframe."""
        query = text(f'''
            INSERT INTO "{SCHEMA}".sync_status (timeframe, last_synced, last_candle_time)
            VALUES (:tf, NOW(), :last_candle)
            ON CONFLICT (timeframe) DO UPDATE
            SET last_synced = NOW(), last_candle_time = :last_candle
        ''')
        def _run():
            with self.engine.connect() as conn:
                conn.execute(query, {"tf": timeframe, "last_candle": last_candle_time})
                conn.commit()
        self._with_retry(_run)

    def get_sync_status(self):
        """Return dict of timeframe -> last_candle_time."""
        query = text(f'SELECT timeframe, last_candle_time FROM "{SCHEMA}".sync_status')
        with self.engine.connect() as conn:
            result = conn.execute(query).fetchall()
            return {row[0]: row[1] for row in result}

    def ensure_live_order_rsi_table(self):
        query = text(f'''
            CREATE TABLE IF NOT EXISTS "{SCHEMA}".live_order_rsi (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT live_order_rsi_singleton CHECK (id = 1)
            )
        ''')
        with self.engine.connect() as conn:
            conn.execute(query)
            conn.commit()

    def upsert_live_order_rsi(self, payload: dict):
        import json as json_lib
        query = text(f'''
            INSERT INTO "{SCHEMA}".live_order_rsi (id, payload, updated_at)
            VALUES (1, CAST(:payload AS jsonb), NOW())
            ON CONFLICT (id) DO UPDATE
            SET payload = EXCLUDED.payload, updated_at = NOW()
        ''')
        def _run():
            with self.engine.connect() as conn:
                conn.execute(query, {"payload": json_lib.dumps(payload)})
                conn.commit()
        self._with_retry(_run)

    def ensure_live_gann_intraday_table(self):
        query = text(f'''
            CREATE TABLE IF NOT EXISTS "{SCHEMA}".live_gann_intraday (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT live_gann_intraday_singleton CHECK (id = 1)
            )
        ''')
        with self.engine.connect() as conn:
            conn.execute(query)
            conn.commit()

    def upsert_live_gann_intraday(self, payload: dict):
        import json as json_lib
        query = text(f'''
            INSERT INTO "{SCHEMA}".live_gann_intraday (id, payload, updated_at)
            VALUES (1, CAST(:payload AS jsonb), NOW())
            ON CONFLICT (id) DO UPDATE
            SET payload = EXCLUDED.payload, updated_at = NOW()
        ''')
        def _run():
            with self.engine.connect() as conn:
                conn.execute(query, {"payload": json_lib.dumps(payload)})
                conn.commit()
        self._with_retry(_run)

    def ensure_liquidity_setups_table(self):
        query = text(f'''
            CREATE TABLE IF NOT EXISTS "{SCHEMA}".liquidity_setups (
                setup_id VARCHAR(64) PRIMARY KEY,
                setup_date DATE NOT NULL,
                ny_time VARCHAR(16),
                ist_time VARCHAR(16),
                direction VARCHAR(16) NOT NULL,
                sweep_level NUMERIC(12, 5),
                structure_level NUMERIC(12, 5),
                entry NUMERIC(12, 5),
                sl NUMERIC(12, 5),
                tp1 NUMERIC(12, 5),
                tp2 NUMERIC(12, 5),
                result VARCHAR(16),
                rr_achieved NUMERIC(8, 2),
                rsi_htf NUMERIC(8, 2),
                rsi_ltf NUMERIC(8, 2),
                notes TEXT,
                how_spotted TEXT,
                payload JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ''')
        with self.engine.connect() as conn:
            conn.execute(query)
            conn.execute(text(f'CREATE INDEX IF NOT EXISTS idx_liquidity_setups_date ON "{SCHEMA}".liquidity_setups (setup_date DESC)'))
            conn.commit()

    def clear_liquidity_setups_for_tf(self, entry_tf: str, htf: str, ltf: str) -> None:
        """Remove stale rows for a TF combo (matches Java scan clear)."""
        query = text(f'''
            DELETE FROM "{SCHEMA}".liquidity_setups
            WHERE (payload->>'entryTf' = :entry_tf AND payload->>'htf' = :htf AND payload->>'ltf' = :ltf)
               OR payload IS NULL
               OR payload::text = '{{}}'
        ''')
        with self.engine.connect() as conn:
            conn.execute(query, {"entry_tf": entry_tf, "htf": htf, "ltf": ltf})
            conn.commit()

    def upsert_liquidity_setup(self, setup: dict):
        import json as json_lib
        query = text(f'''
            INSERT INTO "{SCHEMA}".liquidity_setups (
                setup_id, setup_date, ny_time, ist_time, direction,
                sweep_level, structure_level, entry, sl, tp1, tp2,
                result, rr_achieved, rsi_htf, rsi_ltf, notes, how_spotted, payload
            ) VALUES (
                :setup_id, :setup_date, :ny_time, :ist_time, :direction,
                :sweep_level, :structure_level, :entry, :sl, :tp1, :tp2,
                :result, :rr_achieved, :rsi_htf, :rsi_ltf, :notes, :how_spotted, CAST(:payload AS jsonb)
            )
            ON CONFLICT (setup_id) DO UPDATE SET
                result = EXCLUDED.result,
                rr_achieved = EXCLUDED.rr_achieved,
                payload = EXCLUDED.payload
        ''')
        payload = setup.get("payload") or {}
        params = {
            "setup_id": setup["setup_id"],
            "setup_date": setup["date"],
            "ny_time": setup.get("ny_time"),
            "ist_time": setup.get("ist_time"),
            "direction": setup["direction"],
            "sweep_level": setup.get("sweep_level"),
            "structure_level": setup.get("structure_level"),
            "entry": setup.get("entry"),
            "sl": setup.get("sl"),
            "tp1": setup.get("tp1"),
            "tp2": setup.get("tp2"),
            "result": setup.get("result"),
            "rr_achieved": setup.get("rr_achieved"),
            "rsi_htf": setup.get("rsi_htf"),
            "rsi_ltf": setup.get("rsi_ltf"),
            "notes": setup.get("notes"),
            "how_spotted": setup.get("how_spotted"),
            "payload": json_lib.dumps(payload),
        }
        def _run():
            with self.engine.connect() as conn:
                conn.execute(query, params)
                conn.commit()
        self._with_retry(_run)

    def fetch_liquidity_setups(self, limit: int = 500) -> list:
        query = text(f'''
            SELECT setup_id, setup_date, ny_time, ist_time, direction,
                   sweep_level, structure_level, entry, sl, tp1, tp2,
                   result, rr_achieved, rsi_htf, rsi_ltf, notes, how_spotted, payload
            FROM "{SCHEMA}".liquidity_setups
            ORDER BY setup_date DESC, ny_time DESC
            LIMIT :limit
        ''')
        with self.engine.connect() as conn:
            rows = conn.execute(query, {"limit": limit}).fetchall()
        out = []
        for r in rows:
            out.append({
                "setup_id": r[0],
                "date": str(r[1]),
                "ny_time": r[2],
                "ist_time": r[3],
                "direction": r[4],
                "sweep_level": float(r[5]) if r[5] is not None else None,
                "structure_level": float(r[6]) if r[6] is not None else None,
                "entry": float(r[7]) if r[7] is not None else None,
                "sl": float(r[8]) if r[8] is not None else None,
                "tp1": float(r[9]) if r[9] is not None else None,
                "tp2": float(r[10]) if r[10] is not None else None,
                "result": r[11],
                "rr_achieved": float(r[12]) if r[12] is not None else None,
                "rsi_htf": float(r[13]) if r[13] is not None else None,
                "rsi_ltf": float(r[14]) if r[14] is not None else None,
                "notes": r[15],
                "how_spotted": r[16],
                "payload": r[17] or {},
            })
        return out

    def ensure_live_ny_liquidity_sweep_table(self):
        query = text(f'''
            CREATE TABLE IF NOT EXISTS "{SCHEMA}".live_ny_liquidity_sweep (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT live_ny_liquidity_sweep_singleton CHECK (id = 1)
            )
        ''')
        with self.engine.connect() as conn:
            conn.execute(query)
            conn.commit()

    def upsert_live_ny_liquidity_sweep(self, payload: dict):
        import json as json_lib
        query = text(f'''
            INSERT INTO "{SCHEMA}".live_ny_liquidity_sweep (id, payload, updated_at)
            VALUES (1, CAST(:payload AS jsonb), NOW())
            ON CONFLICT (id) DO UPDATE
            SET payload = EXCLUDED.payload, updated_at = NOW()
        ''')
        def _run():
            with self.engine.connect() as conn:
                conn.execute(query, {"payload": json_lib.dumps(payload)})
                conn.commit()
        self._with_retry(_run)

    def fetch_candles_chronological(self, timeframe_key: str, limit: int = 5000) -> pd.DataFrame:
        """Fetch OHLC rows ASC (oldest first) for analysis."""
        table_name = get_table_name(timeframe_key)
        query = text(f'''
            SELECT time, open, high, low, close, tick_volume
            FROM "{SCHEMA}"."{table_name}"
            ORDER BY time DESC
            LIMIT :limit
        ''')
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(query, conn, params={"limit": limit})
        except Exception as exc:
            if "does not exist" in str(exc).lower():
                return pd.DataFrame()
            raise
        if df.empty:
            return df
        return df.sort_values("time").reset_index(drop=True)

    def get_last_timestamp(self, table_name: str) -> pd.Timestamp:
        """Get the latest timestamp already stored in the table.
        Returns None if the table does not exist yet (first run).
        """
        query = text(f'SELECT MAX("time") FROM "{SCHEMA}"."{table_name}"')
        try:
            with self.engine.connect() as conn:
                result = conn.execute(query).scalar()
                if result:
                    return pd.Timestamp(result)
        except Exception as e:
            # Table might not exist yet on first run
            if "does not exist" in str(e).lower() or "UndefinedTable" in str(type(e)):
                return None
            logger.warning(f"Unexpected error checking last timestamp for {table_name}: {e}")
            return None
        return None

    def upsert_dataframe(self, df: pd.DataFrame, table_name: str):
        """
        Insert data using upsert (ON CONFLICT DO NOTHING) on time column.
        Efficient for incremental updates.
        """
        if df.empty:
            return

        table = self._get_table_definition(table_name)

        # Convert to records
        records = df.to_dict(orient='records')

        stmt = insert(table).values(records)
        stmt = stmt.on_conflict_do_nothing(index_elements=['time'])

        def _run():
            with self.engine.begin() as conn:
                conn.execute(stmt)

        self._with_retry(_run)
        logger.info(f"Upserted {len(df)} rows into {SCHEMA}.{table_name}")

    def save_data(self, df: pd.DataFrame, timeframe_key: str):
        """High level method to save data for a specific timeframe."""
        table_name = get_table_name(timeframe_key)
        self.create_table_if_not_exists(table_name)
        self.upsert_dataframe(df, table_name)
