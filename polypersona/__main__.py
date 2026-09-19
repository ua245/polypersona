from __future__ import annotations

import argparse
import asyncio
import os
import time
import webbrowser
from pathlib import Path

from . import evaluator, store
from .live import FsBackend, LiveBoard
from .models import SessionReport
from .orchestrator import Result, RunConfig, judge, plan, run_local, run_on_modal, session_ids


async def cmd_run(a: argparse.Namespace) -> None:
    if a.headed and not a.modal:
        os.environ["POLYPERSONA_HEADED"] = "1"
    config = RunConfig(
        personas=a.personas, audience=a.audience, variants=a.variants.split(","), repeats=a.repeats,
        url_a=a.url_a, url_b=a.url_b, goal=a.goal, success_url=a.success_url, success_text=a.success_text, success_selector=a.success_selector,
    )
    if config.audience:
        print(f"Generating {config.personas} personas…")
    jobs = await plan(config)
    if a.repeats < 3:
        print("Note: fewer than 3 repeats per persona and variant. Treat the result as directional.")

    run_dir = Path("runs") / time.strftime("%Y%m%d-%H%M%S")
    where = "on Modal" if a.modal else "locally"
    backend = FsBackend(run_dir)
    board = LiveBoard(backend, run_dir.name, jobs, session_ids(jobs), where, config.model_dump())
    await board.flush()
    if a.live:
        url = backend.serve()
        print(f"Live view: {url}")
        webbrowser.open(url)

    async def on_result(result: Result) -> None:
        report: SessionReport = result[0]
        await board.session_done(report, has_video=bool(result[2]))
        print(f"  {report.session_id}: {report.outcome} ({len(report.steps) - 1} actions, {report.input_tokens + report.output_tokens:,} tokens)", flush=True)

    print(f"Running {len(jobs)} sessions {where}…")
    try:
        if a.modal:
            from modal_app import app, run_session_remote

            async with app.run():
                results = await run_on_modal(jobs, board, on_result, run_session_remote)
        else:
            results = await run_local(jobs, board, on_result, a.concurrency)
        print("Evaluating…")
        metrics, verdict, tokens = await judge(results, board)
        out = store.save_run(run_dir, results, metrics, verdict, tokens)
        await board.set_status("finished", report="report.html", metrics=[m.model_dump() for m in metrics], verdict=verdict.model_dump() if verdict else None, tokens=tokens)
    except BaseException:
        await board.set_status("failed")
        raise

    if verdict:
        print(f"\nWinner: {verdict.winner} (confidence {verdict.confidence})\n{verdict.rationale}")
    else:
        print("Every session errored; nothing to evaluate.")
    total = sum(r.input_tokens + r.output_tokens for r, _, _ in results) + sum(tokens.values())
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
