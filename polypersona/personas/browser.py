"""Coordinator-side handle on the Chromium session running inside one sandbox."""

import json
from dataclasses import dataclass
from pathlib import Path

from polypersona.sandbox.config import BROWSER_PORT, REMOTE_ARTIFACTS_DIR, REMOTE_SCRIPTS_DIR, REMOTE_SITE_DIR, SITE_PORT
from polypersona.sandbox.manager import BranchSandbox

from .models import VIEWPORTS, Viewport

REMOTE_SHOTS = f"{REMOTE_ARTIFACTS_DIR}/steps"


@dataclass
class BrowserState:
    step: int
    url: str
    title: str
    changed: bool
    note: str
    error: str | None
    text: str
    elapsed_ms: int
    screenshot_png: bytes
    local_screenshot: Path


class SandboxBrowser:
    def __init__(self, sandbox: BranchSandbox, *, viewport: Viewport, shots_dir: Path):
        self.sandbox = sandbox
        self.viewport = viewport
        self.shots_dir = shots_dir
        self.base_url = f"http://127.0.0.1:{SITE_PORT}"

    async def start_site(self, variant: str) -> None:
        cmd = (
            f"cd {REMOTE_SITE_DIR} && SITE_VARIANT={variant} nohup python -m uvicorn shop.main:app "
            f"--host 127.0.0.1 --port {SITE_PORT} > /tmp/site.log 2>&1 &"
        )
        await self.sandbox.exec("sh", "-c", cmd)
        await self._wait(f"{self.base_url}/health", "/tmp/site.log")

    async def start_browser(self) -> None:
        width, height = VIEWPORTS[self.viewport]
        mobile = " --mobile" if self.viewport == "mobile" else ""
        cmd = (
            f"nohup python {REMOTE_SCRIPTS_DIR}/browser_server.py --port {BROWSER_PORT} "
            f"--width {width} --height {height}{mobile} --shots {REMOTE_SHOTS} > /tmp/browser.log 2>&1 &"
        )
        await self.sandbox.exec("sh", "-c", cmd)
        await self._wait(f"http://127.0.0.1:{BROWSER_PORT}/", "/tmp/browser.log")

    async def _wait(self, url: str, log_path: str) -> None:
        res = await self.sandbox.exec("python", f"{REMOTE_SCRIPTS_DIR}/wait_http.py", url, "40", timeout_s=60)
        if res.exit_code != 0:
            log = await self.sandbox.exec("tail", "-n", "40", log_path)
            raise RuntimeError(f"{url} did not come up: {res.stderr}\n{log.stdout}")

    async def act(self, action: dict) -> BrowserState:
        res = await self.sandbox.exec(
            "python", f"{REMOTE_SCRIPTS_DIR}/browser_ctl.py", str(BROWSER_PORT), json.dumps(action), timeout_s=75
        )
        try:
            data = json.loads(res.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"browser did not answer (exit {res.exit_code}): {res.stderr[-500:]}") from exc
        if "screenshot" not in data:
            raise RuntimeError(f"browser action failed: {data.get('error')}")
        png = await self.sandbox.sandbox.filesystem.read_bytes.aio(data["screenshot"])
        self.shots_dir.mkdir(parents=True, exist_ok=True)
        local = self.shots_dir / f"{data['step']:03d}.png"
        local.write_bytes(png)
        return BrowserState(
            step=data["step"],
            url=data["url"],
            title=data["title"],
            changed=data["changed"],
            note=data.get("note", ""),
            error=data.get("error"),
            text=data.get("text", ""),
            elapsed_ms=data.get("elapsed_ms", 0),
            screenshot_png=png,
            local_screenshot=local,
        )

    async def verified_order(self, event_id: str, quantity: int) -> dict | None:
        """Ground truth: did an order for this event and quantity land in this sandbox's database?"""
        script = (
            "import sqlite3,json;"
            f"c=sqlite3.connect('{REMOTE_SITE_DIR}/data/site.db');c.row_factory=sqlite3.Row;"
            "r=c.execute('select id,event_id,quantity,total_cents,variant from orders "
            "where event_id=? and quantity=? order by id limit 1',(%r,%d)).fetchone();"
            "print(json.dumps(dict(r) if r else None))" % (event_id, quantity)
        )
        res = await self.sandbox.exec("python", "-c", script)
        if res.exit_code != 0:
            raise RuntimeError(f"order check failed: {res.stderr}")
        return json.loads(res.stdout)
