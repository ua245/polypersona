from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path

from playwright.async_api import Browser, Page, Playwright, async_playwright

VIEWPORTS = {"desktop": (1280, 800), "mobile": (390, 844)}
GRID = 1000  # the model addresses the screen on a 0-1000 grid on both axes

# A visible cursor so the clicks can be followed in the screen recording and in headed mode.
# It is hidden while taking the screenshots the agent sees.
CURSOR_JS = """
window.addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.id = '__pp_cursor';
  c.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
    'background:rgba(227,38,54,.45);border:2px solid #fff;box-shadow:0 0 0 1px #e32636;pointer-events:none;transition:transform .12s;left:-50px;top:-50px';
  document.body.appendChild(c);
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => c.style.transform = 'scale(.55)', true);
  addEventListener('mouseup', () => c.style.transform = '', true);
});
"""


class BrowserSession:
    """One isolated headless browser. All coordinates are on the 0-1000 grid."""

    def __init__(self, device: str = "desktop"):
        self.width, self.height = VIEWPORTS[device]
        self.mobile = device == "mobile"
        self.headed = os.environ.get("POLYPERSONA_HEADED") == "1"
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._video_dir = tempfile.mkdtemp(prefix="pp-video-")
        self.video: bytes | None = None  # webm of the whole session, available after the session closes
        self.page: Page | None = None

    async def __aenter__(self) -> "BrowserSession":
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(args=["--no-sandbox"], headless=not self.headed, slow_mo=350 if self.headed else 0)
        context = await self._browser.new_context(
            viewport={"width": self.width, "height": self.height},
            is_mobile=self.mobile,
            has_touch=self.mobile,
            record_video_dir=self._video_dir,
            record_video_size={"width": self.width, "height": self.height},
        )
        await context.add_init_script(CURSOR_JS)
        self.page = await context.new_page()
        return self

    async def __aexit__(self, *exc) -> None:
        try:
            await self.page.context.close()  # finalises the recording
            self.video = Path(await self.page.video.path()).read_bytes()
        except Exception:
            pass
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()

    def _px(self, x: int, y: int) -> tuple[float, float]:
        clamp = lambda v: max(0, min(GRID, v))
        return clamp(x) / GRID * self.width, clamp(y) / GRID * self.height

    @property
    def url(self) -> str:
        return self.page.url

    async def _settle(self) -> None:
        try:
            await self.page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass
        await self.page.wait_for_timeout(250)

    async def goto(self, url: str) -> None:
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await self._settle()

    async def click(self, x: int, y: int) -> None:
        px = self._px(x, y)
        await self.page.mouse.move(*px, steps=12)
        await self.page.mouse.click(*px)
        await self._settle()

    async def type_text(self, x: int, y: int, text: str, press_enter: bool = False) -> None:
        px = self._px(x, y)
        await self.page.mouse.move(*px, steps=12)
        await self.page.mouse.click(*px)
        await self.page.keyboard.press("ControlOrMeta+A")
        await self.page.keyboard.type(text, delay=15)
        if press_enter:
            await self.page.keyboard.press("Enter")
        await self._settle()

    async def scroll(self, direction: str, amount: int = 600) -> None:
        await self.page.mouse.move(self.width / 2, self.height / 2)
        await self.page.mouse.wheel(0, amount if direction == "down" else -amount)
        await self._settle()

    async def press_key(self, key: str) -> None:
        await self.page.keyboard.press(key)
        await self._settle()

    async def go_back(self) -> None:
        await self.page.go_back()
        await self._settle()

    async def wait(self, seconds: float) -> None:
        await self.page.wait_for_timeout(min(seconds, 5) * 1000)

    async def screenshot(self) -> bytes:
        toggle = "v => { const c = document.getElementById('__pp_cursor'); if (c) c.style.display = v; }"
        await self.page.evaluate(toggle, "none")
        try:
            return await self.page.screenshot(type="jpeg", quality=70)
        finally:
            await self.page.evaluate(toggle, "")


def digest(image: bytes) -> str:
    return hashlib.md5(image).hexdigest()
