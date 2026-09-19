from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .db import connect

app = FastAPI(title="Ticket Shop")
STATIC = Path(__file__).resolve().parent / "static"


class PurchaseRequest(BaseModel):
    customer_id: str
    ticket_id: str
    quantity: int = Field(gt=0, le=10)
    idempotency_key: str = Field(min_length=1, max_length=200)


def order_dict(row) -> dict:
    return {
        "id": row["id"],
        "customer_id": row["customer_id"],
        "ticket_id": row["ticket_id"],
        "quantity": row["quantity"],
        "idempotency_key": row["idempotency_key"],
    }


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/tickets")
def list_tickets():
    conn = connect()
    try:
        rows = conn.execute("SELECT id, name, price_cents FROM tickets ORDER BY id").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.post("/api/purchases", status_code=201)
def purchase(req: PurchaseRequest):
    conn = connect()
    try:
        if not conn.execute("SELECT 1 FROM tickets WHERE id = ?", (req.ticket_id,)).fetchone():
            raise HTTPException(404, "unknown ticket")
        cur = conn.execute(
            "INSERT INTO orders (customer_id, ticket_id, quantity, idempotency_key) VALUES (?, ?, ?, ?)",
            (req.customer_id, req.ticket_id, req.quantity, req.idempotency_key),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (cur.lastrowid,)).fetchone()
        return order_dict(row)
    finally:
        conn.close()


@app.get("/api/orders")
def list_orders(x_customer_id: str = Header()):
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM orders WHERE customer_id = ? ORDER BY id", (x_customer_id,)
        ).fetchall()
        return [order_dict(r) for r in rows]
    finally:
        conn.close()


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, x_customer_id: str = Header()):
    conn = connect()
    try:
        row = conn.execute(
            "SELECT * FROM orders WHERE id = ? AND customer_id = ?", (order_id, x_customer_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "order not found")
        return order_dict(row)
    finally:
        conn.close()
