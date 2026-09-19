from __future__ import annotations

import functools
import threading
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from pydantic_ai import BinaryContent, UsageLimits

from .browser import BrowserSession
from .models import Persona, SessionReport, TestTask
from .persona_agent import Recorder, SessionDeps, persona_agent

SITE_DIR = Path(__file__).resolve().parent.parent / "site"


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass


def _serve_demo_site() -> tuple[ThreadingHTTPServer, str]:
    handler = functools.partial(_QuietHandler, directory=str(SITE_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


async def run_session(persona: Persona, task: TestTask, repeat: int = 0) -> tuple[SessionReport, list[bytes], bytes | None]:
    """Run one persona against one variant in a fresh browser. Returns the report, one screenshot per step, and a webm recording."""
    session_id = f"{persona.id}-{task.variant_id}-{repeat}"
    recorder = Recorder()
    report = SessionReport(session_id=session_id, persona=persona, variant_id=task.variant_id, outcome="error")
    server = None
    browser = None
    started = time.time()
    try:
        url = task.url
        if url.startswith("demo://"):
            server, base = _serve_demo_site()
            url = f"{base}/{url.removeprefix('demo://')}/"
        browser = BrowserSession(persona.device)
        async with browser:
            await browser.goto(url)
            first = await browser.screenshot()
            recorder.add("open", {"url": task.url}, "", browser.url, first)
            deps = SessionDeps(browser=browser, persona=persona, task=task, recorder=recorder)
            result = await persona_agent.run(
                ["You have just opened the site. This is your screen:", BinaryContent(data=first, media_type="image/jpeg")],
                deps=deps,
                usage_limits=UsageLimits(request_limit=persona.patience_steps * 2 + 10),
            )
            report.exit_survey = result.output
            reached = bool(task.success_url_contains) and task.success_url_contains in browser.url
            if reached or (task.success_url_contains is None and result.output.believes_completed):
                report.outcome = "completed"
            elif deps.actions_left <= 0:
                report.outcome = "out_of_steps"
            else:
                report.outcome = "gave_up"
    except Exception as exc:  # a crashed session is data, not a failed run
        report.error = f"{type(exc).__name__}: {exc}\n{traceback.format_exc(limit=3)}"
    finally:
        if server:
            server.shutdown()
    report.steps = recorder.steps
    report.observations = recorder.observations
    report.duration_s = round(time.time() - started, 1)
    return report, recorder.screenshots, browser.video if browser else None
