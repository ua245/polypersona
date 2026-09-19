from __future__ import annotations

import argparse
import asyncio
import os
import queue as queue_mod
import time
import webbrowser
from pathlib import Path

from . import evaluator, store
from .live import LiveBoard
from .metrics import compute_metrics
from .models import Persona, SessionReport, TestTask
from .personas import DEFAULT_PERSONAS, demo_tasks, generate_personas
from .session import run_session, session_id_for

Job = tuple[Persona, TestTask, int]
Result = tuple[SessionReport, list[bytes], bytes | None]


def _log(report: SessionReport) -> None:
    print(f"  {report.session_id}: {report.outcome} ({len(report.steps) - 1} actions, {report.input_tokens + report.output_tokens:,} tokens)", flush=True)


async def _run_local(jobs: list[Job], board: LiveBoard, concurrency: int) -> list[Result]:
    gate = asyncio.Semaphore(concurrency)

    async def one(job: Job) -> Result:
        async with gate:
            result = await run_session(*job, sink=board.handle)
            _log(result[0])
            return result

    return await asyncio.gather(*(one(j) for j in jobs))


async def _run_modal(jobs: list[Job], board: LiveBoard) -> list[Result]:
    import modal

    from modal_app import app, run_session_remote

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

    async with app.run(), modal.Queue.ephemeral() as queue:
        pumping = asyncio.create_task(pump(queue))
        args = [(p.model_dump_json(), t.model_dump_json(), rep, queue) for p, t, rep in jobs]
        async for report_json, shots, video in run_session_remote.starmap.aio(args, order_outputs=False, return_exceptions=True):
            if isinstance(report_json, Exception):  # container died; the steps it streamed are already on disk
                print(f"  a session container failed: {report_json}")
                continue
            report = SessionReport.model_validate_json(report_json)
            _log(report)
            out.append((report, shots, video))
        done.set()
        await pumping
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
        checks = dict(success_url_contains=a.success_url, success_text_contains=a.success_text, success_selector=a.success_selector)
        tasks = [TestTask(variant_id=v, url=u, goal=a.goal, **checks) for v, u in (("a", a.url_a), ("b", a.url_b))]
    else:
        tasks = demo_tasks(a.variants.split(","))
    jobs = [(p, t, r) for p in personas for t in tasks for r in range(a.repeats)]
    if a.repeats < 3:
        print("Note: fewer than 3 repeats per persona and variant. Treat the result as directional.")

    run_dir = Path("runs") / time.strftime("%Y%m%d-%H%M%S")
    where = "on Modal" if a.modal else "locally"
    board = LiveBoard(run_dir, jobs, [session_id_for(*j) for j in jobs], where)
    if a.live:
        url = board.serve()
        print(f"Live view: {url}")
        webbrowser.open(url)

    print(f"Running {len(jobs)} sessions ({len(personas)} personas × {len(tasks)} variants × {a.repeats}) {where}…")
    try:
        results = await _run_modal(jobs, board) if a.modal else await _run_local(jobs, board, a.concurrency)
        reports = [r for r, _, _ in results]
        metrics = compute_metrics(reports)
        verdict, eval_usage = None, None
        if any(r.outcome != "error" for r in reports):
            board.set_status("evaluating")
            print("Evaluating…")
            deps = evaluator.EvalDeps(reports=reports, metrics=metrics, screenshots={r.session_id: s for r, s, _ in results})
            verdict, eval_usage = await evaluator.evaluate(deps)
        else:
            print("Every session errored; nothing to evaluate.")
        out = store.save_run(run_dir, results, metrics, verdict, eval_usage)
        board.set_status("finished", report="report.html", verdict=verdict.model_dump() if verdict else None)
    except BaseException:
        board.set_status("failed")
        raise

    if verdict:
        print(f"\nWinner: {verdict.winner} (confidence {verdict.confidence})\n{verdict.rationale}")
    total = sum(r.input_tokens + r.output_tokens for r in reports) + (eval_usage.input_tokens + eval_usage.output_tokens if eval_usage else 0)
    print(f"\nTokens used: {total:,}\nReport: {out}")
    if a.live:
        print("The live view stays up so its links keep working. Press Ctrl+C to stop.")
        await asyncio.Event().wait()


async def cmd_ask(a: argparse.Namespace) -> None:
    deps, verdict = store.load_run(Path(a.run_dir))
    print(await evaluator.ask(deps, a.question, verdict))


def main() -> None:
    parser = argparse.ArgumentParser(prog="polypersona")
    sub = parser.add_subparsers(required=True)
    run = sub.add_parser("run", help="run personas against both variants and evaluate")
    run.add_argument("--modal", action="store_true", help="one Modal container per session instead of local browsers")
    run.add_argument("--live", action="store_true", help="open a live dashboard that follows every session")
    run.add_argument("--headed", action="store_true", help="local mode only: show real browser windows with a visible cursor")
    run.add_argument("--personas", type=int, default=1)
    run.add_argument("--repeats", type=int, default=1)
    run.add_argument("--concurrency", type=int, default=3, help="local mode only")
    run.add_argument("--audience", help="generate personas for this audience instead of the built-in three")
    run.add_argument("--variants", default="a,b", help="demo shop variants to compare: a (clean), b (dark patterns), c (plausible redesign)")
    run.add_argument("--url-a")
    run.add_argument("--url-b")
    run.add_argument("--goal")
    run.add_argument("--success-url", help="substring of the final URL that proves the task was completed")
    run.add_argument("--success-text", help="text that must be visible on the final page")
    run.add_argument("--success-selector", help="CSS selector that must exist on the final page")
    run.set_defaults(fn=cmd_run)
    ask = sub.add_parser("ask", help="ask the evaluator a question about a finished run")
    ask.add_argument("run_dir")
    ask.add_argument("question")
    ask.set_defaults(fn=cmd_ask)
    args = parser.parse_args()
    try:
        asyncio.run(args.fn(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
