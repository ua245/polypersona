import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("SHOP_DB_PATH", Path(__file__).resolve().parent.parent / "data" / "shop.db"))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price_cents INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            ticket_id TEXT NOT NULL REFERENCES tickets(id),
            quantity INTEGER NOT NULL,
            idempotency_key TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
