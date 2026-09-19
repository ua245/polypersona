import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("SHOP_SITE_DB", Path(__file__).resolve().parent.parent / "data" / "site.db"))

EVENTS = [
    # id, name, venue, date, price_cents
    ("jazz-night", "Jazz Night", "Blue Room", "Fri 16 Oct, 20:00", 3500),
    ("indie-fest", "Indie Fest", "Riverside Park", "Sat 24 Oct, 14:00", 6200),
    ("comedy-hour", "Comedy Hour", "The Cellar", "Thu 29 Oct, 19:30", 2200),
    ("symphony", "City Symphony", "Grand Hall", "Sun 1 Nov, 18:00", 5400),
]


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init() -> None:
    conn = connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY, name TEXT, venue TEXT, date TEXT, price_cents INTEGER
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                total_cents INTEGER NOT NULL,
                variant TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.executemany("INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?, ?)", EVENTS)
        conn.commit()
    finally:
        conn.close()
