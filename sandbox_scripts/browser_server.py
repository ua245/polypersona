"""A long-lived Chromium session inside the sandbox, driven one action at a time.

The persona agent runs on the coordinator. Each of its actions reaches this server via
`browser_ctl.py` (run with sandbox exec), so the browser only ever talks to localhost and
no credentials enter the sandbox.

Requests are handled serially on one thread, which is what Playwright's sync API needs.

Usage: python browser_server.py --port 9300 --width 1280 --height 800 [--mobile] --shots DIR
"""

import argparse
import hashlib
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=9300)
parser.add_argument("--width", type=int, default=1280)
parser.add_argument("--height", type=int, default=800)
parser.add_argument("--mobile", action="store_true")
parser.add_argument("--shots", default="/tmp/polypersona-artifacts/steps")
args = parser.parse_args()

SHOTS = Path(args.shots)
SHOTS.mkdir(parents=True, exist_ok=True)
MAX_TEXT = 2500

pw = sync_playwright().start()
browser = pw.chromium.launch()
context = browser.new_context(
    viewport={"width": args.width, "height": args.height},
    is_mobile=args.mobile,
    has_touch=args.mobile,
    device_scale_factor=1,
)
page = context.new_page()
page.set_default_timeout(8000)
step = 0


# Form state and focus are not in page.content(), so include them: focusing a field,
# typing or ticking a box is a visible change, not a dead click.
FORM_STATE_JS = """() => {
  const a = document.activeElement;
  const fields = [...document.querySelectorAll('input, textarea, select')]
    .map(el => el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : el.value);
  return (a ? a.tagName + '#' + (a.name || a.id || '') : '') + '|' + fields.join('\\u0001');
}"""


def fingerprint() -> str:
    try:
        state = page.url + page.content() + page.evaluate(FORM_STATE_JS)
        return hashlib.sha1(state.encode()).hexdigest()
    except PlaywrightError:
        return ""


def settle() -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=3000)
    except PlaywrightError:
        pass
    page.wait_for_timeout(250)


def to_px(x: float, y: float) -> tuple[float, float]:
    """Map the model's 0-1000 grid onto the viewport."""
    x = min(max(float(x), 0), 1000)
    y = min(max(float(y), 0), 1000)
    return x / 1000 * args.width, y / 1000 * args.height


def do(action: dict) -> dict:
    kind = action.get("action")
    note = ""
    if kind == "goto":
        page.goto(action["url"], wait_until="domcontentloaded")
    elif kind == "click":
        px, py = to_px(action["x"], action["y"])
        target = page.evaluate(
            """([x, y]) => { const el = document.elementFromPoint(x, y);
                 if (!el) return null;
                 const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
                 return el.tagName.toLowerCase() + (t ? ': ' + t.slice(0, 60) : ''); }""",
            [px, py],
        )
        note = f"clicked {target or 'empty space'} at ({px:.0f},{py:.0f})px"
        if args.mobile:
            page.touchscreen.tap(px, py)
        else:
            page.mouse.click(px, py)
    elif kind == "type":
        page.keyboard.type(str(action["text"]), delay=15)
        if action.get("enter"):
            page.keyboard.press("Enter")
    elif kind == "press":
        page.keyboard.press(str(action["key"]))
    elif kind == "scroll":
        dy = {"down": 1, "up": -1}.get(action.get("direction", "down"), 1) * args.height * 0.7
        page.mouse.wheel(0, dy)
    elif kind == "back":
        page.go_back(wait_until="domcontentloaded")
    elif kind == "wait":
        page.wait_for_timeout(min(int(action.get("ms", 1000)), 5000))
    elif kind == "observe":
        pass
    else:
        raise ValueError(f"unknown action {kind!r}")
    return {"note": note}


def perform(action: dict) -> dict:
    global step
    before = fingerprint()
    t0 = time.monotonic()
    error = None
    note = ""
    try:
        note = do(action)["note"]
        settle()
    except (PlaywrightError, ValueError, KeyError) as exc:
        error = f"{type(exc).__name__}: {str(exc).splitlines()[0][:300]}"
    step += 1
    shot = SHOTS / f"{step:03d}.png"
    page.screenshot(path=str(shot))
    try:
        text = page.evaluate("document.body ? document.body.innerText : ''")
    except PlaywrightError:
        text = ""
    after = fingerprint()
    return {
        "step": step,
        "url": page.url,
        "title": page.title(),
        "screenshot": str(shot),
        "changed": before != after,
        "note": note,
        "error": error,
        "text": text[:MAX_TEXT],
        "elapsed_ms": int((time.monotonic() - t0) * 1000),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # keep stdout quiet
        pass

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send(200, {"ok": True, "step": step})

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        try:
            self._send(200, perform(data))
        except Exception as exc:  # noqa: BLE001 - report instead of killing the session
            self._send(500, {"error": repr(exc)})


HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
