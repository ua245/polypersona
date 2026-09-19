// Demo shop. "a" is the clean flow, "b" carries deliberate UX flaws and one bug, and "c" is a plausible
// redesign of "a": faster (buy now, inline errors, collects an email) but with a pre-ticked subscription.
const V = window.VARIANT;
const B = V === "b";
const C = V === "c";
document.body.className = V;

const PRODUCTS = [
  { id: "yirgacheffe", name: "Ethiopia Yirgacheffe", notes: "Jasmine, bergamot, lemon", price: 18.5, color: "#c98b4a" },
  { id: "huila", name: "Colombia Huila", notes: "Caramel, red apple, cocoa", price: 16.0, color: "#8a4b2a" },
  { id: "sumatra", name: "Sumatra Mandheling", notes: "Cedar, dark chocolate, spice", price: 17.25, color: "#4a2c1a" },
  { id: "decaf", name: "Decaf Swiss Water", notes: "Hazelnut, brown sugar", price: 15.5, color: "#a67c52" },
];
const SHIPPING = 4.5;
const HANDLING = B ? 3.45 : 0;

const state = { cart: {}, account: false, ship: {}, modalSeen: false, notice: "", subscribed: false };
const money = (n) => "$" + n.toFixed(2);
const count = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
const subtotal = () => Object.entries(state.cart).reduce((s, [id, q]) => s + PRODUCTS.find((p) => p.id === id).price * q, 0);
const go = (h) => { location.hash = h; };
const val = (id) => (document.getElementById(id) || {}).value || "";

function header() {
  const label = B ? `bag (${count()})` : `Cart · ${count()} item${count() === 1 ? "" : "s"}`;
  return `<div class="top"><a class="brand" href="#/">Kettle &amp; Crop</a><a class="cartlink" href="#/cart">${label}</a></div>`;
}

function home() {
  const cards = PRODUCTS.map((p) => `
    <div class="card">
      <div class="swatch" style="background:${p.color}"></div>
      <strong>${p.name}</strong><span class="muted">${p.notes} · 250g</span>
      <div class="row between"><span class="price">${money(p.price)}</span>
      <span class="row">${C ? `<button data-add="${p.id}" class="secondary">Add</button><button data-buy="${p.id}">Buy now</button>` : `<button data-add="${p.id}" class="${B ? "secondary" : ""}">${B ? "Select" : "Add to cart"}</button>`}</span></div>
    </div>`).join("");
  const notice = state.notice && !B ? `<div class="notice">${state.notice} <a href="#/cart">View cart</a></div>` : "";
  return `<h1>Fresh roasted, shipped weekly</h1>${notice}<div class="grid">${cards}</div>`;
}

function cart() {
  if (!count()) return `<h1>Your cart</h1><p>Your cart is empty.</p><a class="btn secondary" href="#/">Browse coffee</a>`;
  const rows = Object.entries(state.cart).map(([id, q]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return `<div><span>${p.name} × ${q}</span><span>${money(p.price * q)}</span></div>`;
  }).join("");
  const totals = B
    ? `<div class="total"><span>Subtotal</span><span>${money(subtotal())}</span></div>`
    : `<div><span>Shipping</span><span>${money(SHIPPING)}</span></div><div class="total"><span>Total</span><span>${money(subtotal() + SHIPPING)}</span></div>`;
  const actions = B
    ? `<div class="row"><button class="loud" data-act="clear">Cancel order</button><button class="weak" data-act="checkout">Continue</button></div>`
    : `<div class="row"><a class="btn secondary" href="#/">Keep shopping</a><button data-act="checkout">Checkout</button></div>`;
  return `<h1>Your cart</h1><div class="summary">${rows}${totals}</div>${actions}`;
}

function account() {
  return `<div class="steps">Step 1 of 4 · Account</div><h1>Create an account to continue</h1>
    <label for="email">Email</label><input id="email" type="email">
    <label for="pw">Password</label><input id="pw" type="password">
    <label for="pw2">Confirm password</label><input id="pw2" type="password">
    <div class="err" id="err"></div><br><button class="weak" data-act="account">Continue</button>`;
}

function shippingForm() {
  const phone = B ? `<label for="phone">Phone</label><input id="phone" value="${state.ship.phone || ""}">` : "";
  return `${B ? '<div class="steps">Step 2 of 4 · Delivery</div>' : ""}<h1>${B ? "Delivery" : "Checkout"}</h1>
    ${B ? "" : '<p class="muted">No account needed. Shipping is a flat ' + money(SHIPPING) + ".</p><h2>Shipping address</h2>"}
    <label for="name">Full name</label><input id="name" value="${state.ship.name || ""}">
    <label for="street">Street address</label><input id="street" value="${state.ship.street || ""}">
    <div class="two"><div><label for="city">City</label><input id="city" value="${state.ship.city || ""}"></div>
    <div><label for="zip">ZIP code</label><input id="zip" value="${state.ship.zip || ""}"></div></div>${phone}`;
}

function paymentForm() {
  return `<label for="card">Card number</label><input id="card" inputmode="numeric" placeholder="1234 5678 9012 3456">
    <div class="two"><div><label for="exp">Expiry (MM/YY)</label><input id="exp" placeholder="MM/YY"></div>
    <div><label for="cvc">CVC</label><input id="cvc" inputmode="numeric"></div></div>`;
}

function checkoutA() {
  const total = subtotal() + SHIPPING;
  const email = C ? `<label for="email">Email for your receipt</label><input id="email" type="email" value="${state.ship.email || ""}">` : "";
  const sub = C ? `<label class="check"><input type="checkbox" id="sub" checked> Subscribe &amp; save: send this order every 4 weeks</label>` : "";
  return `${shippingForm()}${email}<h2>Payment</h2>${paymentForm()}${sub}
    <div class="summary"><div><span>Subtotal</span><span>${money(subtotal())}</span></div><div><span>Shipping</span><span>${money(SHIPPING)}</span></div>
    <div class="total"><span>Total</span><span>${money(total)}</span></div></div>
    <div class="err" id="err"></div><button data-act="place">Place order · ${money(total)}</button>`;
}

function deliveryB() { return `${shippingForm()}<div class="err" id="err"></div><br><button class="weak" data-act="delivery">Continue</button>`; }
function paymentB() {
  return `<div class="steps">Step 3 of 4 · Payment</div><h1>Payment</h1>${paymentForm()}<div class="err" id="err"></div><br><button class="weak" data-act="payment">Continue</button>`;
}
function reviewB() {
  const total = subtotal() + SHIPPING + HANDLING;
  return `<div class="steps">Step 4 of 4 · Review</div><h1>Review</h1>
    <div class="summary"><div><span>Subtotal</span><span>${money(subtotal())}</span></div><div><span>Shipping</span><span>${money(SHIPPING)}</span></div>
    <div><span>Handling &amp; packaging</span><span>${money(HANDLING)}</span></div><div class="total"><span>Total</span><span>${money(total)}</span></div></div>
    <div class="row"><button class="loud" data-act="clear">Cancel order</button><button class="weak" data-act="confirm">Submit</button></div>`;
}
function confirmed() {
  const sub = state.subscribed ? "<p>Your subscription is active. We will send this order every 4 weeks.</p>" : "";
  return `<h1>Order confirmed</h1><p>Thanks${state.ship.name ? ", " + state.ship.name.split(" ")[0] : ""}! Order #KC-${1000 + Math.floor(Math.random() * 9000)} is on its way. A receipt has been emailed to you.</p>${sub}`;
}
function modal() {
  return `<div class="overlay"><div class="modal"><h2>Get 10% off your first bag</h2><p class="muted">Join 40,000 coffee lovers.</p>
    <input id="nl" placeholder="Email address"><br><br><button data-act="modal">Sign me up</button>
    <button class="nothanks" data-act="modal">no thanks, I prefer paying full price</button></div></div>`;
}

const ROUTES = { "": home, cart, account, checkout: B ? deliveryB : checkoutA, payment: paymentB, review: reviewB, confirmed };

function render() {
  const route = location.hash.replace(/^#\/?/, "");
  let view = ROUTES[route] || home;
  if (["checkout", "payment", "review", "account"].includes(route) && !count()) view = cart;
  if (B && route === "checkout" && !state.account) view = account;
  let html = header() + `<main>${view()}</main>`;
  if (B && !state.modalSeen && view === home) html += modal();
  document.getElementById("app").innerHTML = html;
  window.scrollTo(0, 0);
}

function fail(msg) { document.getElementById("err").textContent = msg; }
function readShip() { for (const k of ["name", "street", "city", "zip", "phone", "email"]) if (document.getElementById(k)) state.ship[k] = val(k).trim(); }
function shipOk() { return state.ship.name && state.ship.street && state.ship.city && /^\d{5}$/.test(state.ship.zip); }
function cardOk() { return val("card").replace(/\s/g, "").length === 16 && /^\d{2}\/\d{2}$/.test(val("exp").trim()) && /^\d{3,4}$/.test(val("cvc").trim()); }

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    const id = add.dataset.add;
    state.cart[id] = (state.cart[id] || 0) + 1;
    state.notice = `${PRODUCTS.find((p) => p.id === id).name} added to your cart.`;
    render();
    return;
  }
  const buy = e.target.closest("[data-buy]");
  if (buy) { state.cart = { [buy.dataset.buy]: 1 }; go("#/checkout"); return; }
  const act = (e.target.closest("[data-act]") || { dataset: {} }).dataset.act;
  if (!act) return;
  if (act === "modal") { state.modalSeen = true; render(); }
  if (act === "clear") { state.cart = {}; go("#/"); render(); }
  if (act === "checkout") go("#/checkout");
  if (act === "account") {
    const pw = val("pw");
    if (!/.+@.+\..+/.test(val("email")) || pw.length < 10 || !/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw) || pw !== val("pw2")) return fail("Invalid input.");
    state.account = true; render();
  }
  if (act === "delivery") {
    readShip();
    if (!shipOk()) return fail("Invalid input.");
    // Deliberate bug: formatted phone numbers are rejected with an opaque error.
    if (!/^\d{10}$/.test(state.ship.phone)) return fail("Error 422");
    go("#/payment");
  }
  if (act === "payment") { if (!cardOk()) return fail("Invalid input."); go("#/review"); }
  if (act === "confirm") go("#/confirmed");
  if (act === "place") {
    readShip();
    if (!shipOk()) return fail("Please fill in your name, street, city and a 5-digit ZIP code.");
    if (C && !/.+@.+\..+/.test(val("email"))) return fail("Enter an email address so we can send your receipt.");
    if (!cardOk()) return fail("Check your card: 16-digit number, expiry as MM/YY, and a 3-digit CVC.");
    if (C) { state.subscribed = document.getElementById("sub").checked; state.cart = {}; }
    go("#/confirmed");
  }
});
window.addEventListener("hashchange", render);
render();
