"""Runs the persona × variant × repeat matrix and evaluates it. Shared by the CLI and the cloud API."""

from __future__ import annotations

import asyncio
import queue as queue_mod
from typing import Awaitable, Callable

from pydantic import BaseModel

from . import evaluator
from .live import LiveBoard
from .metrics import compute_metrics
from .models import EvaluatorReport, Persona, SessionReport, TestTask, VariantMetrics
from .personas import DEFAULT_PERSONAS, demo_tasks, generate_personas
from .session import run_session, session_id_for

Job = tuple[Persona, TestTask, int]
Result = tuple[SessionReport, list[bytes], bytes | None]
OnResult = Callable[[Result], Awaitable[None]]


# What a person has to hand when a real site asks for it. Card keys match PRIVATE_FIXTURES, so the model never sees them.
SITE_FIXTURES = {
    "full name": "use your own name",
    "work email": "use firstname.lastname@ your company's domain, e.g. jo.smith@acme.io",
    "company name": "use the company from your bio, or make up a plausible one",
    "password": "make one up that a careful person would use",
    "card number": "4242 4242 4242 4242",
    "card expiry": "09/28",
    "card CVC": "314",
}


class RunConfig(BaseModel):
    name: str | None = None  # what the person called this test
    persona_ids: list[str] | None = None  # built-in personas by id; None means the first `personas`
    personas: int = 1
    audience: str | None = None  # generate `personas` personas for this audience instead
    custom_personas: list[Persona] | None = None  # full persona objects, e.g. generated earlier in the UI
    variants: list[str] = ["a", "b"]  # demo shop variants
    url_a: str | None = None
    url_b: str | None = None
    goal: str | None = None
    success_url: str | None = None
    success_text: str | None = None
    success_selector: str | None = None
    fixtures: dict[str, str] | None = None  # details personas may type on your own site; sensible defaults otherwise
    repeats: int = 1


async def plan(config: RunConfig) -> list[Job]:
    if config.custom_personas:
        personas = config.custom_personas[:10]
    elif config.audience:
        personas = await generate_personas(config.audience, config.personas)
    elif config.persona_ids:
        personas = [p for p in DEFAULT_PERSONAS if p.id in config.persona_ids]
    else:
        personas = DEFAULT_PERSONAS[: config.personas]
    if config.url_a and config.url_b and config.goal:
        checks = dict(success_url_contains=config.success_url, success_text_contains=config.success_text, success_selector=config.success_selector)
        fixtures = config.fixtures if config.fixtures is not None else SITE_FIXTURES
        tasks = [TestTask(variant_id=v, url=u, goal=config.goal, fixtures=fixtures, **checks) for v, u in (("a", config.url_a), ("b", config.url_b))]
    else:
        tasks = demo_tasks(config.variants)
    return [(p, t, r) for p in personas for t in tasks for r in range(config.repeats)]


def session_ids(jobs: list[Job]) -> list[str]:
    return [session_id_for(*j) for j in jobs]


async def run_local(jobs: list[Job], board: LiveBoard, on_result: OnResult, concurrency: int = 3) -> list[Result]:
    gate = asyncio.Semaphore(concurrency)

    async def one(job: Job) -> Result:
        async with gate:
            result = await run_session(*job, sink=board.handle)
            await on_result(result)
            return result

    return await asyncio.gather(*(one(j) for j in jobs))


async def run_on_modal(jobs: list[Job], board: LiveBoard, on_result: OnResult, run_session_remote, run_id: str | None = None) -> list[Result]:
    """One Modal container per session. Steps stream back over a queue while the sessions run."""
    import modal

    out: list[Result] = []
    done = asyncio.Event()

    async def pump(queue) -> None:
        while True:
            try:
                events = await queue.get_many.aio(50, block=True, timeout=1)
            except queue_mod.Empty:  # nothing arrived within the timeout
                events = []
            for event in events:
                await board.handle(event)
            if done.is_set() and not events:
                return

    async with modal.Queue.ephemeral() as queue:
        pumping = asyncio.create_task(pump(queue))
        args = [(p.model_dump_json(), t.model_dump_json(), rep, queue, f"{run_id}/{session_id_for(p, t, rep)}/control" if run_id else None) for p, t, rep in jobs]
        async for item in run_session_remote.starmap.aio(args, order_outputs=False, return_exceptions=True):
            if isinstance(item, Exception):  # container died; the steps it streamed are already stored
                print(f"  a session container failed: {item}", flush=True)
                continue
            report_json, shots, video = item
            result = (SessionReport.model_validate_json(report_json), shots, video)
            await on_result(result)
            out.append(result)
        done.set()
        await pumping
    return sorted(out, key=lambda r: r[0].session_id)


async def judge(results: list[Result], board: LiveBoard) -> tuple[list[VariantMetrics], EvaluatorReport | None, dict]:
    reports = [r for r, _, _ in results]
    metrics = compute_metrics(reports)
    verdict, tokens = None, {}
    if any(r.outcome != "error" for r in reports):
        await board.set_status("evaluating", metrics=[m.model_dump() for m in metrics])
        deps = evaluator.EvalDeps(reports=reports, metrics=metrics, screenshots={r.session_id: s for r, s, _ in results})
        verdict, usage = await evaluator.evaluate(deps)
        tokens = {"evaluator_input": usage.input_tokens, "evaluator_output": usage.output_tokens}
    return metrics, verdict, tokens
