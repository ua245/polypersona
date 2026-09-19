"""One persona, one variant, one fresh sandbox with its own site, database and browser."""

import asyncio
import logging
from datetime import UTC, datetime
from pathlib import Path

from pydantic_ai import BinaryContent, UsageLimits
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.models import Model
from pydantic_ai.usage import RunUsage

from polypersona.sandbox.manager import SandboxPool
from polypersona.sandbox.redact import redact

from .agent import SessionDeps, agent, perform
from .browser import SandboxBrowser
from .models import SessionReport, TestTask
from .recorder import SessionRecorder

log = logging.getLogger(__name__)


def contact_for(name: str) -> dict:
    return {"name": f"{name} Example", "email": f"{name.lower()}@example.com", "phone": "555 0100"}


async def run_session(
    pool: SandboxPool,
    report: SessionReport,
    task: TestTask,
    *,
    run_dir: Path,
    model: Model,
    session_timeout_s: float,
) -> SessionReport:
    rec = SessionRecorder(run_dir, report)
    report.status = "starting"
    report.started_at = datetime.now(UTC)
    await rec.save()
    usage = RunUsage()
    branch = None
    try:
        branch = await pool.create_session_sandbox(report.session_id)
        report.sandbox_id = branch.sandbox_id
        await rec.save()

        browser = SandboxBrowser(branch, viewport=report.persona.viewport, shots_dir=rec.dir / "shots")
        await browser.start_site(report.variant)
        await browser.start_browser()
        report.status = "running"
        await rec.save()

        deps = SessionDeps(
            browser=browser, recorder=rec, persona=report.persona, task=task, contact=contact_for(report.persona.name)
        )
        first = await perform(deps, {"action": "goto", "url": browser.base_url + task.start_path}, "open the website")
        prompt = [
            task.goal,
            "You've just opened the website. This is what you see:",
            BinaryContent(first.screenshot_png, media_type="image/png"),
        ]
        limits = UsageLimits(request_limit=report.persona.patience_steps * 2 + 10)
        try:
            result = await asyncio.wait_for(
                agent.run(prompt, deps=deps, model=model, usage_limits=limits, usage=usage),
                timeout=session_timeout_s,
            )
            report.exit_survey = result.output
        except UsageLimitExceeded:
            deps.out_of_patience = True
        except TimeoutError:
            deps.out_of_patience = True
            report.error = f"session hit the {session_timeout_s:.0f}s wall-clock limit"

        # Completion comes from the sandbox database, not from what the agent believes.
        report.verified_order = await browser.verified_order(task.success_event_id, task.success_quantity)
        if report.verified_order:
            report.outcome = "completed"
        elif deps.out_of_patience:
            report.outcome = "out_of_steps"
        else:
            report.outcome = "gave_up"
    except asyncio.CancelledError:
        report.outcome = "error"
        report.error = "cancelled"
        raise
    except Exception as exc:  # noqa: BLE001 - a crashed session becomes a report, not a failed run
        log.exception("session %s failed", report.session_id)
        report.outcome = "error"
        report.error = redact(f"{type(exc).__name__}: {exc}")[:2000]
    finally:
        report.input_tokens = usage.input_tokens
        report.output_tokens = usage.output_tokens
        report.model_requests = usage.requests
        report.finished_at = datetime.now(UTC)
        report.duration_s = round((report.finished_at - report.started_at).total_seconds(), 1)
        report.status = "finished"
        if branch is not None:
            await asyncio.shield(pool.release(branch))
        await asyncio.shield(rec.save())
    return report
