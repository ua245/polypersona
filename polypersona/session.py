from __future__ import annotations

import asyncio
import functools
import threading
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from pydantic_ai import BinaryContent, UsageLimits
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.usage import RunUsage

from .browser import BrowserSession
from .models import Persona, SessionReport, TestTask
from .persona_agent import PERSONA_MODEL, EventSink, Recorder, SessionDeps, make_model, persona_agent

SITE_DIR = Path(__file__).resolve().parent.parent / "site"
SESSION_TIMEOUT_S = 600


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass


def _serve_demo_site() -> tuple[ThreadingHTTPServer, str]:
    handler = functools.partial(_QuietHandler, directory=str(SITE_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def session_id_for(persona: Persona, task: TestTask, repeat: int) -> str:
    return f"{persona.id}-{task.variant_id}-{repeat}"


async def run_session(
    persona: Persona, task: TestTask, repeat: int = 0, sink: EventSink | None = None, timeout_s: float = SESSION_TIMEOUT_S, control=None
) -> tuple[SessionReport, list[bytes], bytes | None]:
    """Run one persona against one variant in a fresh browser. Returns the report, one screenshot per step, and a webm recording."""
    session_id = session_id_for(persona, task, repeat)
    recorder = Recorder()
    report = SessionReport(session_id=session_id, persona=persona, variant_id=task.variant_id, outcome="error", completion_check=task.completion_check)
    usage = RunUsage()
    server = None
    browser = None
    deps = None
    started = time.time()
    try:
        url = task.url
        if url.startswith("demo://"):
            server, base = _serve_demo_site()
            url = f"{base}/{url.removeprefix('demo://')}/"
        browser = BrowserSession(persona.device, persona.viewport)
        async with browser:
            await browser.goto(url)
            first = await browser.screenshot()
            deps = SessionDeps(browser=browser, persona=persona, task=task, recorder=recorder, session_id=session_id, sink=sink, control=control)
            step = recorder.add("open", {"url": task.url}, "", browser.url, first)
            await deps.emit({"type": "step", "step": step.model_dump(), "image": first, "actions_left": deps.actions_left})
            prompt: list = ["You have just opened the site. This is your screen:", BinaryContent(data=first, media_type="image/jpeg")]
            if persona.reading_style == "reads_everything":
                prompt.append(f"Because you read everything, here is the text on the page:\n{await browser.page_text()}")
            timed_out = False
            try:
                result = await asyncio.wait_for(
                    persona_agent.run(
                        prompt,
                        deps=deps,
                        model=make_model(PERSONA_MODEL),
                        usage=usage,
                        usage_limits=UsageLimits(request_limit=persona.patience_steps * 2 + 10),
                    ),
                    timeout=timeout_s,
                )
                report.exit_survey = result.output
            except UsageLimitExceeded:
                timed_out = True
            except TimeoutError:
                timed_out = True
                report.error = f"session hit the {timeout_s:.0f}s wall-clock limit"

            verified = await browser.check_success(task)
            if verified is None:  # no check configured: fall back to the persona's word
                verified = bool(report.exit_survey and report.exit_survey.believes_completed)
            if verified:
                report.outcome = "completed"
            elif timed_out or deps.actions_left <= 0:
                report.outcome = "out_of_steps"
            else:
                report.outcome = "gave_up"
    except Exception as exc:  # a crashed session is data, not a failed run
        report.outcome = "error"
        report.error = f"{type(exc).__name__}: {exc}\n{traceback.format_exc(limit=3)}"
    finally:
        if server:
            server.shutdown()
    report.steps = recorder.steps
    report.observations = recorder.observations
    report.duration_s = round(time.time() - started, 1)
    report.input_tokens, report.output_tokens, report.model_requests = usage.input_tokens, usage.output_tokens, usage.requests
    if deps:
        await deps.emit({"type": "finished", "outcome": report.outcome, "error": report.error, "exit_survey": report.exit_survey.model_dump() if report.exit_survey else None})
    return report, recorder.screenshots, browser.video if browser else None
