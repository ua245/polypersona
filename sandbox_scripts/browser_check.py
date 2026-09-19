"""Predefined checkout journey, run with Chromium inside the sandbox.

This is a fixed automated browser check, not autonomous browsing. It buys a
ticket, presses "Retry last request" (which resends the identical request with
the same idempotency key) and reports how many orders the customer ends up with.

Usage: python browser_check.py <base_url> <screenshot_dir>
Prints one JSON object on the last line of stdout.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base_url, shot_dir = sys.argv[1], Path(sys.argv[2])
shot_dir.mkdir(parents=True, exist_ok=True)
result = {"ok": False, "observations": [], "screenshots": [], "orders_after_buy": None, "orders_after_retry": None}


def count(page) -> int:
    return int(page.locator("#order-count").inner_text())


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 900, "height": 700})
    try:
        page.goto(base_url, wait_until="networkidle")
        page.wait_for_selector("#ticket option", state="attached")
        before = count(page)
        result["observations"].append(f"loaded shop, customer has {before} orders")

        page.click("#buy")
        page.wait_for_function(f"Number(document.querySelector('#order-count').textContent) >= {before}")
        page.wait_for_selector("#status:not(:empty)")
        result["orders_after_buy"] = count(page) - before
        result["observations"].append(f"after Buy: status={page.inner_text('#status')!r}")
        path = shot_dir / "01_after_buy.png"
        page.screenshot(path=str(path))
        result["screenshots"].append(str(path))

        page.evaluate("document.querySelector('#status').textContent = ''")
        page.click("#retry")
        page.wait_for_selector("#status:not(:empty)")
        page.wait_for_load_state("networkidle")
        result["orders_after_retry"] = count(page) - before
        result["observations"].append(f"after Retry: status={page.inner_text('#status')!r}")
        path = shot_dir / "02_after_retry.png"
        page.screenshot(path=str(path))
        result["screenshots"].append(str(path))

        result["ok"] = result["orders_after_retry"] == 1
        result["observations"].append(
            "retry created no duplicate" if result["ok"] else f"retry produced {result['orders_after_retry']} orders (expected 1)"
        )
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as an observation
        result["observations"].append(f"browser check error: {exc!r}")
    finally:
        browser.close()

print(json.dumps(result))
