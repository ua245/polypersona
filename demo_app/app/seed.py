"""Reset the demo database to its fixture state."""

from .db import DB_PATH, connect, init_schema

TICKETS = [
    ("concert-ga", "Concert - General Admission", 4500),
    ("concert-vip", "Concert - VIP", 12000),
]

# Fixture identities; there is no real authentication in the demo app.
CUSTOMERS = ["alice", "bob"]


def seed() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = connect()
    try:
        init_schema(conn)
        conn.executemany("INSERT INTO tickets (id, name, price_cents) VALUES (?, ?, ?)", TICKETS)
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    seed()
    print(f"seeded {DB_PATH}")
