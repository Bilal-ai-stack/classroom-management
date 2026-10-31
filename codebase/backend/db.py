import sqlite3

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()


@event.listens_for(Engine, 'connect')
def configure_sqlite_connection(dbapi_connection, connection_record):
    """Apply safety settings to every SQLite connection, including test databases."""
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return

    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA foreign_keys = ON')
    cursor.execute('PRAGMA busy_timeout = 5000')
    cursor.execute('PRAGMA synchronous = NORMAL')
    # WAL is durable and concurrency-friendly for a local file. SQLite reports
    # "memory" for in-memory databases, where WAL is not supported.
    database_path = cursor.execute('PRAGMA database_list').fetchone()[2]
    if database_path:
        cursor.execute('PRAGMA journal_mode = WAL')
    cursor.close()
