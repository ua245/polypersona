"""Runs the persona x variant x repeat matrix, one sandbox per session, then evaluates.

Everything is written under runs/<run_id>/ as it happens, so the dashboard can poll it
and a finished run can be replayed later.
"""

import asyncio
import logging
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from polypersona.sandbox.config import RUNS_DIR, SandboxSettings
from polypersona.sandbox.manager import SandboxPool
from polypersona.sandbox.redact import redact

from . import metrics as metrics_mod
from .agent import make_model
from .evaluator import evaluate
from .fixtures import PERSONAS, TASKS
from .models import EvaluatorReport, SessionReport, VariantMetrics
from .recorder import write_json_atomic
from .session import run_session

log = logging.getLogger(__name__)

RunStatus = Literal["starting", "running", "evaluating", "finished", "failed", "cancelled"]


class RunConfig(BaseModel):
    persona_ids: list[str] = [p.id for p in PERSONAS]
    task_id: str = "jazz-2"
    repeats: int = 1
    max_parallel: int = 6
    session_timeout_s: float = 600
    model: str | None = None
    evaluator_model: str | None = None


class RunState(BaseModel):
    run_id: str
    status: RunStatus
    created_at: datetime
    finished_at: datetime | None = None
    config: RunConfig
    model: str
    session_ids: list[str]
    metrics: dict[str, VariantMetrics] | None = None
    evaluation: EvaluatorReport | None = None
    evaluator_tokens: dict | None = None
    error: str | None = None


def new_run_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]


def plan_sessions(config: RunConfig) -> list[SessionReport]:
    """Pair every persona with both variants; interleave so A and B progress together."""
    by_id = {p.id: p for p in PERSONAS}
    reports = []
    for repeat in range(1, config.repeats + 1):
        for pid in config.persona_ids:
            for variant in ("A", "B"):
                reports.append(
                    SessionReport(
                        session_id=f"{pid}-{variant}-r{repeat}",
                        persona=by_id[pid],
                        variant=variant,
                        repeat=repeat,
                    )
                )
    return reports


async def execute_run(run_id: str, config: RunConfig, runs_dir: Path = RUNS_DIR) -> RunState:
    run_dir = runs_dir / run_id
    model_name = config.model or os.environ.get("GEMINI_MODEL", "")
    reports = plan_sessions(config)
    state = RunState(
        run_id=run_id,
        status="starting",
        created_at=datetime.now(UTC),
        config=config,
        model=model_name,
        session_ids=[r.session_id for r in reports],
    )
    save = lambda: write_json_atomic(run_dir / "run.json", state)  # noqa: E731
    save()
    for r in reports:
        write_json_atomic(run_dir / "sessions" / r.session_id / "session.json", r)

    task = TASKS[config.task_id]
    model = make_model(config.model)
    gate = asyncio.Semaphore(config.max_parallel)

    async def guarded(report: SessionReport) -> SessionReport:
        async with gate:
            return await run_session(
                pool, report, task, run_dir=run_dir, model=model, session_timeout_s=config.session_timeout_s
            )

    try:
        async with SandboxPool(run_id, settings=SandboxSettings(), runs_dir=runs_dir) as pool:
            await pool.prepare_baseline()
            state.status = "running"
            save()
            await asyncio.gather(*(guarded(r) for r in reports), return_exceptions=True)

        state.metrics = metrics_mod.compute(reports)
        state.status = "evaluating"
        save()
        usable = [r for r in reports if r.outcome != "error"]
        if usable:
            evaluation, usage = await evaluate(
                reports, state.metrics, run_dir=run_dir, model=make_model(config.evaluator_model or config.model)
            )
            state.evaluation = evaluation
            state.evaluator_tokens = {"input": usage.input_tokens, "output": usage.output_tokens}
        else:
            state.error = "every session errored; nothing to evaluate"
        state.status = "finished"
    except asyncio.CancelledError:
        state.status = "cancelled"
        state.metrics = metrics_mod.compute(reports)
        raise
    except Exception as exc:  # noqa: BLE001
        log.exception("run %s failed", run_id)
        state.status = "failed"
        state.error = redact(f"{type(exc).__name__}: {exc}")[:2000]
    finally:
        state.finished_at = datetime.now(UTC)
        save()
    return state
