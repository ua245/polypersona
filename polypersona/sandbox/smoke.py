"""Live end-to-end check of the multi-sandbox layer (needs Modal credentials).

    uv run python -m polypersona.sandbox.smoke                      # 2 branches
    uv run python -m polypersona.sandbox.smoke --branches 3
    uv run python -m polypersona.sandbox.smoke --fail-branch B      # one branch crashes
    uv run python -m polypersona.sandbox.smoke --cancel-after 20    # cancel mid-run

What it checks, against real Modal sandboxes:
  1. Every branch starts from the same seeded snapshot (same file hashes, same DB rows).
  2. Editing branch A's workspace does not change branch B's (files, diff, database).
  3. Work in the branches overlaps in time (concurrent execution, not sequential).
  4. The demo app runs in each sandbox and Chromium drives it there; the baseline
     reproduces the duplicate-order bug (retry -> 2 orders).
  5. One branch failing does not stop the others.
  6. Every sandbox is terminated at the end (success, failure or cancellation) and
     the registry of live sandbox IDs is empty afterwards.
"""

import argparse
import asyncio
import json
import logging
import string
import time
import uuid
from datetime import UTC, datetime

from .config import SandboxSettings
from .manager import BranchSandbox, SandboxPool
from .registry import SandboxRegistry

HASH_CMD = ("sh", "-c", "git ls-files -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1")
ORDER_COUNT_CMD = (
    "python",
    "-c",
    "import sqlite3,os;c=sqlite3.connect(os.environ['SHOP_DB_PATH']);"
    "print(c.execute('select count(*) from orders').fetchone()[0])",
)


class Report:
    def __init__(self) -> None:
        self.checks: list[dict] = []

    def check(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append({"name": name, "passed": passed, "detail": detail})
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""), flush=True)

    @property
    def ok(self) -> bool:
        return all(c["passed"] for c in self.checks)


async def branch_workload(branch: BranchSandbox, *, fail: bool, t0: float) -> dict:
    """What each branch does concurrently: boot the app and run the browser journey."""
    out: dict = {"branch_id": branch.branch_id, "sandbox_id": branch.sandbox_id}
    out["start_s"] = round(time.monotonic() - t0, 2)
    if fail:
        await asyncio.sleep(1)
        raise RuntimeError(f"simulated failure in branch {branch.branch_id}")
    started = await branch.start_app()
    if started.exit_code != 0:
        raise RuntimeError(f"app failed to start: {started.stderr}")
    browser = await branch.run_browser_check()
    out["browser"] = browser.model_dump()
    out["end_s"] = round(time.monotonic() - t0, 2)
    return out


async def main(args: argparse.Namespace) -> int:
    run_id = datetime.now(UTC).strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    branch_ids = list(string.ascii_uppercase[: args.branches])
    registry = SandboxRegistry()
    report = Report()
    pool = SandboxPool(run_id, settings=SandboxSettings(), registry=registry)
    created: list[BranchSandbox] = []
    summary: dict = {"run_id": run_id, "branches": branch_ids}
    print(f"run {run_id}: {len(branch_ids)} branches {branch_ids}", flush=True)

    try:
        async with pool:
            t = time.monotonic()
            print("building image + seeded baseline snapshot (first build can take a few minutes)...", flush=True)
            image = await pool.prepare_baseline()
            summary["baseline_image_id"] = image.object_id
            summary["baseline_s"] = round(time.monotonic() - t, 1)
            print(f"  baseline snapshot {image.object_id} in {summary['baseline_s']}s", flush=True)

            t = time.monotonic()
            created = await pool.fork(branch_ids)
            summary["fork_s"] = round(time.monotonic() - t, 1)
            summary["sandboxes"] = {b.branch_id: b.sandbox_id for b in created}
            print(f"  forked in {summary['fork_s']}s: {summary['sandboxes']}", flush=True)
            report.check("distinct sandbox per branch", len({b.sandbox_id for b in created}) == len(created))

            # 1. identical starting state
            hashes = await asyncio.gather(*(b.exec(*HASH_CMD) for b in created))
            counts = await asyncio.gather(*(b.exec(*ORDER_COUNT_CMD) for b in created))
            report.check(
                "identical baseline files",
                len({h.stdout.strip() for h in hashes}) == 1,
                hashes[0].stdout.strip()[:16],
            )
            report.check(
                "identical seeded database",
                {c.stdout.strip() for c in counts} == {"0"},
                f"orders per branch = {[c.stdout.strip() for c in counts]}",
            )

            # 2. isolation: edit A only
            a, others = created[0], created[1:]
            marker = f"# isolation marker {uuid.uuid4().hex}\n"
            original = await a.read_file("app/main.py")
            await a.write_file("app/main.py", original + marker)
            await a.write_file("app/new_module.py", "X = 1\n")
            diff_a = await a.get_diff()
            report.check("branch A sees its own edit", marker.strip() in diff_a and "new_module.py" in diff_a)
            for b in others:
                content = await b.read_file("app/main.py")
                diff_b = await b.get_diff()
                files_b = await b.list_files()
                report.check(
                    f"branch {b.branch_id} unaffected by A's edit",
                    marker not in content and diff_b == "" and "app/new_module.py" not in files_b,
                )
            await a.write_file("app/main.py", original)
            await a.exec("rm", "-f", "app/new_module.py")
            await a.exec("git", "reset", "-q")
            report.check("branch A restored to baseline", await a.get_diff() == "")

            # path validation is enforced before any call reaches Modal
            try:
                await a.read_file("../../etc/passwd")
                report.check("path escape rejected", False)
            except ValueError:
                report.check("path escape rejected", True)

            # 3-5. concurrent workloads, one may be forced to fail
            if args.cancel_after:
                print(f"  will cancel in {args.cancel_after}s", flush=True)
            t0 = time.monotonic()
            tasks = [
                asyncio.create_task(branch_workload(b, fail=b.branch_id == args.fail_branch, t0=t0)) for b in created
            ]
            if args.cancel_after:
                await asyncio.sleep(args.cancel_after)
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                raise asyncio.CancelledError("cancel requested by --cancel-after")
            results = await asyncio.gather(*tasks, return_exceptions=True)

            ok_results = [r for r in results if isinstance(r, dict)]
            summary["workloads"] = [r if isinstance(r, dict) else {"error": repr(r)} for r in results]
            for b, r in zip(created, results, strict=True):
                if isinstance(r, BaseException):
                    expected = b.branch_id == args.fail_branch
                    report.check(f"branch {b.branch_id} failure {'isolated' if expected else 'UNEXPECTED'}", expected, repr(r))
                else:
                    br = r["browser"]
                    report.check(
                        f"branch {b.branch_id}: browser ran in sandbox and reproduced bug",
                        br["orders_after_buy"] == 1 and br["orders_after_retry"] == 2,
                        f"after buy={br['orders_after_buy']} after retry={br['orders_after_retry']} "
                        f"window={r['start_s']}-{r['end_s']}s, screenshots={len(br['screenshots'])}",
                    )
            if len(ok_results) >= 2:
                latest_start = max(r["start_s"] for r in ok_results)
                earliest_end = min(r["end_s"] for r in ok_results)
                report.check(
                    "branch workloads overlapped in time",
                    latest_start < earliest_end,
                    f"overlap {round(earliest_end - latest_start, 2)}s",
                )

            # branch DBs are independent too: each has exactly its own 2 orders
            survivors = [b for b in created if b.branch_id != args.fail_branch]
            counts = await asyncio.gather(*(b.exec(*ORDER_COUNT_CMD) for b in survivors))
            report.check(
                "each branch database only has its own orders",
                all(c.stdout.strip() == "2" for c in counts),
                str({b.branch_id: c.stdout.strip() for b, c in zip(survivors, counts, strict=True)}),
            )
    except asyncio.CancelledError:
        print("  run cancelled; cleanup ran in the pool's exit handler", flush=True)
        summary["cancelled"] = True

    # 6. cleanup, verified against Modal rather than our own flag
    polls = await asyncio.gather(*(b.sandbox.poll.aio() for b in created))
    report.check("all branch sandboxes terminated", all(p is not None for p in polls), f"exit codes {polls}")
    leftover = {k: v for k, v in registry.load().items() if v.get("run_id") == run_id}
    report.check("registry has no live sandboxes for this run", not leftover, str(list(leftover)))

    summary["checks"] = report.checks
    summary["ok"] = report.ok
    out = pool.run_dir / "sandbox_smoke.json"
    out.write_text(json.dumps(summary, indent=2, default=str))
    print(f"\n{'ALL CHECKS PASSED' if report.ok else 'SOME CHECKS FAILED'} - report: {out}")
    return 0 if report.ok else 1


def cli() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--branches", type=int, default=2, choices=[2, 3])
    parser.add_argument("--fail-branch", help="branch id to crash on purpose, e.g. B")
    parser.add_argument("--cancel-after", type=float, help="cancel the concurrent phase after N seconds")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    raise SystemExit(asyncio.run(main(args)))


if __name__ == "__main__":
    cli()
