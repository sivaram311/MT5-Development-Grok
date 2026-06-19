"""
PostgreSQL Client using SQLAlchemy
Handles connection and data insertion for XAUUSD tables in grok_dev schema.
"""

from sqlalchemy import create_engine, text, Table, Column, TIMESTAMP, Numeric, BigInteger, Integer, MetaData
from sqlalchemy.dialects.postgresql import insert
import pandas as pd
from typing import Dict
import logging

from .config import DB_CONFIG, SCHEMA, get_table_name

logger = logging.getLogger(__name__)


class PostgresClient:
    def __init__(self):
        self.engine = self._create_engine()
        self.metadata = MetaData(schema=SCHEMA)

    def _create_engine(self):
        url = (
            f"postgresql+psycopg2://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
            f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        )
        engine = create_engine(url, echo=False)
        return engine

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

        with self.engine.begin() as conn:
            conn.execute(stmt)

        logger.info(f"Upserted {len(df)} rows into {SCHEMA}.{table_name}")

    def save_data(self, df: pd.DataFrame, timeframe_key: str):
        """High level method to save data for a specific timeframe."""
        table_name = get_table_name(timeframe_key)
        self.create_table_if_not_exists(table_name)
        self.upsert_dataframe(df, table_name)
