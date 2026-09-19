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
  addEventListener('touchstart', e => { const t = e.touches[0]; c.style.left = t.clientX + 'px'; c.style.top = t.clientY + 'px'; }, true);
});
"""


# Everything a person could see change: URL, DOM, form values, focus and scroll position.
# Pixels are not used because carets and animations change them without anything happening.
FINGERPRINT_JS = """() => {
  const c = document.getElementById('__pp_cursor');
  const saved = c ? c.style.cssText : '';
  if (c) c.style.cssText = '';
  const html = document.documentElement.outerHTML;
  if (c) c.style.cssText = saved;
  const a = document.activeElement;
  const fields = [...document.querySelectorAll('input, textarea, select')]
    .map(el => el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : el.value);
  return [location.href, html, a ? a.tagName + '#' + (a.name || a.id || '') : '', fields.join('\u0001'), scrollX, scrollY].join('\u0002');
}"""

TARGET_JS = """([x, y]) => {
  const el = document.elementFromPoint(x, y);
  if (!el || el === document.body || el === document.documentElement) return null;
  const field = el.matches('input, textarea, select');
  const label = field && (el.labels && el.labels[0] ? el.labels[0].innerText : el.getAttribute('aria-label') || el.placeholder || el.name || el.id);
  const t = (field ? label || '' : el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ');
  return (field ? (el.type === 'checkbox' || el.type === 'radio' ? el.type : 'field') : el.tagName.toLowerCase()) + (t ? ': ' + t.slice(0, 60) : '');
}"""

MAX_PAGE_TEXT = 2500


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

    async def fingerprint(self) -> str:
        try:
            return hashlib.sha1((await self.page.evaluate(FINGERPRINT_JS)).encode()).hexdigest()
        except Exception:
            return ""

    async def page_text(self) -> str:
        try:
            return (await self.page.evaluate("document.body ? document.body.innerText : ''"))[:MAX_PAGE_TEXT]
        except Exception:
            return ""

    async def _press_at(self, x: int, y: int) -> str:
        """Tap on mobile, click on desktop. Returns a note naming what was under the pointer."""
        px = self._px(x, y)
        try:
            target = await self.page.evaluate(TARGET_JS, list(px))
        except Exception:
            target = None
        await self.page.mouse.move(*px, steps=12)
        if self.mobile:
            await self.page.touchscreen.tap(*px)
        else:
            await self.page.mouse.click(*px)
        return f"{'tapped' if self.mobile else 'clicked'} {target or 'empty space'}"

    async def click(self, x: int, y: int) -> str:
        note = await self._press_at(x, y)
        await self._settle()
        return note

    async def type_text(self, x: int, y: int, text: str, press_enter: bool = False) -> str:
        note = await self._press_at(x, y)
        await self.page.keyboard.press("ControlOrMeta+A")
        await self.page.keyboard.type(text, delay=15)
        if press_enter:
            await self.page.keyboard.press("Enter")
        await self._settle()
        return note.replace("clicked", "typed into").replace("tapped", "typed into")

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


    async def check_success(self, task) -> bool | None:
        """True/False when the task defines checks, None when it defines none."""
        results = []
        if task.success_url_contains:
            results.append(task.success_url_contains in self.url)
        if task.success_text_contains:
            results.append(task.success_text_contains.lower() in (await self.page.evaluate("document.body ? document.body.innerText : ''")).lower())
        if task.success_selector:
            results.append(await self.page.locator(task.success_selector).count() > 0)
        return all(results) if results else None
