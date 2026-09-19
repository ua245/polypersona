from __future__ import annotations

import argparse
import asyncio
import os
import time
from pathlib import Path

from . import evaluator, store
from .metrics import compute_metrics
from .models import Persona, SessionReport, TestTask
from .personas import DEFAULT_PERSONAS, demo_tasks, generate_personas
from .session import run_session

Job = tuple[Persona, TestTask, int]
Result = tuple[SessionReport, list[bytes], bytes | None]


async def _run_local(jobs: list[Job], concurrency: int) -> list[Result]:
    gate = asyncio.Semaphore(concurrency)

    async def one(job: Job):
        async with gate:
            result = await run_session(*job)
            print(f"  {result[0].session_id}: {result[0].outcome} ({len(result[0].steps) - 1} actions)")
            return result

    return await asyncio.gather(*(one(j) for j in jobs))


async def _run_modal(jobs: list[Job]) -> list[Result]:
    from modal_app import app, run_session_remote

    out = []
    async with app.run():
        args = [(p.model_dump_json(), t.model_dump_json(), rep) for p, t, rep in jobs]
        async for report_json, shots, video in run_session_remote.starmap.aio(args, order_outputs=False):
            report = SessionReport.model_validate_json(report_json)
            print(f"  {report.session_id}: {report.outcome} ({len(report.steps) - 1} actions)")
            out.append((report, shots, video))
    return sorted(out, key=lambda r: r[0].session_id)


async def cmd_run(a: argparse.Namespace) -> None:
    if a.headed and not a.modal:
        os.environ["POLYPERSONA_HEADED"] = "1"
    if a.audience:
        print(f"Generating {a.personas} personas…")
        personas = await generate_personas(a.audience, a.personas)
    else:
        personas = DEFAULT_PERSONAS[: a.personas]
    if a.url_a and a.url_b and a.goal:
        tasks = [TestTask(variant_id=v, url=u, goal=a.goal, success_url_contains=a.success_url) for v, u in (("a", a.url_a), ("b", a.url_b))]
    else:
        tasks = demo_tasks()
    jobs = [(p, t, r) for p in personas for t in tasks for r in range(a.repeats)]
    print(f"Running {len(jobs)} sessions ({len(personas)} personas × {len(tasks)} variants × {a.repeats}) {'on Modal' if a.modal else 'locally'}…")
    results = await _run_modal(jobs) if a.modal else await _run_local(jobs, a.concurrency)

    reports = [r for r, _, _ in results]
    metrics = compute_metrics(reports)
    print("Evaluating…")
    deps = evaluator.EvalDeps(reports=reports, metrics=metrics, screenshots={r.session_id: s for r, s, _ in results})
    verdict = await evaluator.evaluate(deps)
    out = store.save_run(Path("runs") / time.strftime("%Y%m%d-%H%M%S"), results, metrics, verdict)
    print(f"\nWinner: {verdict.winner} (confidence {verdict.confidence})\n{verdict.rationale}\n\nReport: {out}")


async def cmd_ask(a: argparse.Namespace) -> None:
    deps, verdict = store.load_run(Path(a.run_dir))
    print(await evaluator.ask(deps, a.question, verdict))


def main() -> None:
    parser = argparse.ArgumentParser(prog="polypersona")
    sub = parser.add_subparsers(required=True)
    run = sub.add_parser("run", help="run personas against both variants and evaluate")
    run.add_argument("--modal", action="store_true", help="one Modal container per session instead of local browsers")
    run.add_argument("--headed", action="store_true", help="local mode only: show real browser windows with a visible cursor")
    run.add_argument("--personas", type=int, default=1)
    run.add_argument("--repeats", type=int, default=1)
    run.add_argument("--concurrency", type=int, default=3, help="local mode only")
    run.add_argument("--audience", help="generate personas for this audience instead of the built-in three")
    run.add_argument("--url-a")
    run.add_argument("--url-b")
    run.add_argument("--goal")
    run.add_argument("--success-url", help="substring of the URL that proves the task was completed")
    run.set_defaults(fn=cmd_run)
    ask = sub.add_parser("ask", help="ask the evaluator a question about a finished run")
    ask.add_argument("run_dir")
    ask.add_argument("question")
    ask.set_defaults(fn=cmd_ask)
    args = parser.parse_args()
    asyncio.run(args.fn(args))


if __name__ == "__main__":
    main()
