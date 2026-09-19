"""A small ticket store served in two variants of the same checkout flow.

SITE_VARIANT=A  the original flow: prices hidden until checkout, a multi-field form with
                an unmarked required phone field, a vague error banner and a terms box.
SITE_VARIANT=B  the redesign: prices up front, a quantity stepper, only name + email,
                inline field errors and a "Pay $X" button.

Both variants write real orders to SQLite, so task completion can be verified in code.
"""

import html
import os
import re

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from .db import connect, init

VARIANT = os.environ.get("SITE_VARIANT", "A").upper()
app = FastAPI(title="Ticketly")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.on_event("startup")
def _startup() -> None:
    init()


def money(cents: int) -> str:
    return f"${cents / 100:.2f}"


def e(value) -> str:
    return html.escape(str(value), quote=True)


BASE_CSS = """
* { box-sizing: border-box; }
body { font-family: -apple-system, system-ui, sans-serif; margin: 0; color: #1d1d1f; background: #fafafa; }
header { background: #222; color: #fff; padding: 14px 20px; font-weight: 700; font-size: 20px; }
main { max-width: 760px; margin: 0 auto; padding: 20px; }
.card { background: #fff; border: 1px solid #e3e3e3; border-radius: 10px; padding: 16px; margin-bottom: 14px; }
label { display: block; margin: 12px 0 4px; font-size: 14px; }
input[type=text], input[type=email], input[type=tel], input[type=number] {
  width: 100%; padding: 10px; border: 1px solid #bbb; border-radius: 6px; font-size: 16px; }
"""

CSS = {
    "A": BASE_CSS
    + """
.events { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.more { font-size: 12px; color: #999; text-decoration: underline; }
.banner { background: #fdecea; color: #8a1c1c; padding: 10px; border-radius: 6px; }
.terms { font-size: 11px; color: #aaa; }
button { background: #ddd; color: #444; border: 0; padding: 10px 18px; border-radius: 4px; font-size: 14px; }
.promo { background: #fff7d6; border: 2px dashed #e0b400; padding: 12px; border-radius: 8px; margin: 14px 0; }
""",
    "B": BASE_CSS
    + """
.event { display: flex; justify-content: space-between; align-items: center; }
.price { font-weight: 700; font-size: 18px; }
.btn { display: inline-block; background: #0a66ff; color: #fff; border: 0; padding: 12px 20px;
       border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none; cursor: pointer; }
.stepper { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
.stepper button { width: 40px; height: 40px; font-size: 20px; border-radius: 8px; border: 1px solid #bbb; background: #fff; }
.stepper output { font-size: 20px; min-width: 24px; text-align: center; }
.err { color: #c00; font-size: 13px; margin-top: 4px; }
.total { font-size: 18px; margin: 14px 0; }
""",
}


def page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} - Ticketly</title><style>{CSS[VARIANT]}</style></head>
<body><header>Ticketly</header><main>{body}</main></body></html>"""
    )


def get_event(event_id: str):
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "Event not found")
    return row


def all_events():
    conn = connect()
    try:
        return conn.execute("SELECT * FROM events ORDER BY rowid").fetchall()
    finally:
        conn.close()


@app.get("/health")
def health():
    return {"ok": True, "variant": VARIANT}


@app.get("/", response_class=HTMLResponse)
def home():
    events = all_events()
    if VARIANT == "A":
        cards = "".join(
            f"""<div class="card"><h3>{e(ev['name'])}</h3><p>{e(ev['venue'])}</p>
<a class="more" href="/event/{e(ev['id'])}">more info</a></div>"""
            for ev in events
        )
        return page("Events", f"<h2>Upcoming events</h2><div class='events'>{cards}</div>")
    cards = "".join(
        f"""<div class="card event"><div><h3>{e(ev['name'])}</h3>
<div>{e(ev['venue'])} &middot; {e(ev['date'])}</div></div>
<div><div class="price">{money(ev['price_cents'])}</div>
<a class="btn" href="/event/{e(ev['id'])}">Buy tickets</a></div></div>"""
        for ev in events
    )
    return page("Events", f"<h2>Upcoming events</h2>{cards}")


@app.get("/event/{event_id}", response_class=HTMLResponse)
def event_page(event_id: str):
    ev = get_event(event_id)
    if VARIANT == "A":
        body = f"""<div class="card"><h2>{e(ev['name'])}</h2>
<p>{e(ev['venue'])}, {e(ev['date'])}</p>
<p>Join us for an unforgettable evening. Doors open 30 minutes before the show.
Ticket prices and fees are shown at checkout.</p>
<form method="get" action="/checkout/{e(ev['id'])}">
<label for="qty">Number of tickets</label>
<input id="qty" name="qty" type="text" value="1">
<p><button type="submit">Proceed</button></p></form></div>"""
        return page(ev["name"], body)
    body = f"""<div class="card"><h2>{e(ev['name'])}</h2>
<p>{e(ev['venue'])} &middot; {e(ev['date'])}</p>
<p class="price">{money(ev['price_cents'])} per ticket</p>
<form method="get" action="/checkout/{e(ev['id'])}">
<div>How many tickets?</div>
<div class="stepper">
  <button type="button" aria-label="Fewer tickets" onclick="q.value=Math.max(1,+q.value-1);o.value=q.value">&minus;</button>
  <output id="o">1</output>
  <button type="button" aria-label="More tickets" onclick="q.value=Math.min(8,+q.value+1);o.value=q.value">+</button>
</div>
<input type="hidden" id="q" name="qty" value="1">
<p><button class="btn" type="submit">Continue to checkout</button></p></form></div>"""
    return page(ev["name"], body)


def parse_qty(raw: str) -> int | None:
    try:
        qty = int(str(raw).strip())
    except ValueError:
        return None
    return qty if 1 <= qty <= 8 else None


def checkout_form(ev, qty_raw: str, values: dict, errors: dict) -> HTMLResponse:
    v = {k: e(values.get(k, "")) for k in ("name", "email", "phone", "promo")}
    if VARIANT == "A":
        banner = "<p class='banner'>Something went wrong. Please check your details.</p>" if errors else ""
        body = f"""<div class="card"><h2>Checkout</h2>{banner}
<form method="post" action="/checkout/{e(ev['id'])}">
<input type="hidden" name="qty" value="{e(qty_raw)}">
<div class="promo"><strong>Have a promo code?</strong> Enter it below to save!
<input type="text" name="promo" value="{v['promo']}" placeholder="PROMO CODE"></div>
<label>Full name *</label><input type="text" name="name" value="{v['name']}">
<label>Email *</label><input type="text" name="email" value="{v['email']}">
<label>Phone</label><input type="text" name="phone" value="{v['phone']}">
<p class="terms"><input type="checkbox" name="terms" value="yes"> I have read and accept the terms of sale</p>
<p>Tickets: {e(qty_raw)} &middot; Order total: {money(ev['price_cents'] * (parse_qty(qty_raw) or 0) + 350)} incl. booking fee</p>
<button type="submit">Proceed</button></form></div>"""
        return page("Checkout", body)
    qty = parse_qty(qty_raw) or 1

    def err(field: str) -> str:
        return f"<div class='err'>{e(errors[field])}</div>" if field in errors else ""

    body = f"""<div class="card"><h2>Checkout</h2>
<p>{e(ev['name'])} &middot; {qty} &times; {money(ev['price_cents'])}</p>
<form method="post" action="/checkout/{e(ev['id'])}">
<input type="hidden" name="qty" value="{qty}">
<label for="name">Full name</label><input id="name" type="text" name="name" value="{v['name']}">{err('name')}
<label for="email">Email for your tickets</label><input id="email" type="email" name="email" value="{v['email']}">{err('email')}
<p class="total">Total: <strong>{money(ev['price_cents'] * qty)}</strong> (no fees)</p>
<button class="btn" type="submit">Pay {money(ev['price_cents'] * qty)}</button></form></div>"""
    return page("Checkout", body)


@app.get("/checkout/{event_id}", response_class=HTMLResponse)
def checkout_get(event_id: str, qty: str = "1"):
    return checkout_form(get_event(event_id), qty, {}, {})


@app.post("/checkout/{event_id}", response_class=HTMLResponse)
def checkout_post(
    event_id: str,
    qty: str = Form("1"),
    name: str = Form(""),
    email: str = Form(""),
    phone: str = Form(""),
    promo: str = Form(""),
    terms: str = Form(""),
):
    ev = get_event(event_id)
    values = {"name": name, "email": email, "phone": phone, "promo": promo}
    errors: dict[str, str] = {}
    quantity = parse_qty(qty)
    if not name.strip():
        errors["name"] = "Please enter your name."
    if not EMAIL_RE.match(email.strip()):
        errors["email"] = "Please enter a valid email address."
    fee = 0
    if VARIANT == "A":
        fee = 350
        if quantity is None:
            errors["qty"] = "bad quantity"
        # The phone field is required but not marked as such, and no promo code is valid.
        if not re.sub(r"\D", "", phone):
            errors["phone"] = "required"
        if promo.strip():
            errors["promo"] = "invalid"
        if terms != "yes":
            errors["terms"] = "required"
    quantity = quantity or 1
    if errors:
        return checkout_form(ev, qty, values, errors)

    total = ev["price_cents"] * quantity + fee
    conn = connect()
    try:
        cur = conn.execute(
            "INSERT INTO orders (event_id, quantity, name, email, total_cents, variant) VALUES (?, ?, ?, ?, ?, ?)",
            (ev["id"], quantity, name.strip(), email.strip(), total, VARIANT),
        )
        conn.commit()
        order_id = cur.lastrowid
    finally:
        conn.close()
    return RedirectResponse(f"/confirmation/{order_id}", status_code=303)


@app.get("/confirmation/{order_id}", response_class=HTMLResponse)
def confirmation(order_id: int):
    conn = connect()
    try:
        row = conn.execute(
            "SELECT o.*, ev.name AS event_name FROM orders o JOIN events ev ON ev.id = o.event_id WHERE o.id = ?",
            (order_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "Order not found")
    return page(
        "Confirmed",
        f"""<div class="card"><h2>You're going!</h2>
<p>Order #{row['id']}: {row['quantity']} &times; {e(row['event_name'])}</p>
<p>Total paid: {money(row['total_cents'])}. Tickets were sent to {e(row['email'])}.</p></div>""",
    )
