# PolyPersona

Parallel AI repair agents, each working in its own isolated Modal sandbox.
**Status: the multi-sandbox layer is done; the agents, evaluator and dashboard are not built yet.**

## Setup

```bash
uv sync
uv run modal setup          # one-time Modal login (writes ~/.modal.toml)
uv run pytest               # offline tests: path validation and the sandbox registry
```

## Multi-sandbox smoke test (live, uses Modal)

```bash
uv run python -m polypersona.sandbox.smoke                  # 2 isolated branches
uv run python -m polypersona.sandbox.smoke --branches 3
uv run python -m polypersona.sandbox.smoke --fail-branch B  # one branch crashes, the others continue
uv run python -m polypersona.sandbox.smoke --cancel-after 20
uv run python -m polypersona.sandbox.cleanup --tagged       # kill leftovers after a crash
```

Report: `runs/<run_id>/sandbox_smoke.json`. Screenshots: `runs/<run_id>/<branch>/screenshots/`.

## How the sandboxes work

1. `polypersona/sandbox/image.py` builds one image with the demo app (committed to git
   at `/workspace/app`), Python dependencies, Playwright and Chromium.
2. A baseline sandbox seeds the SQLite database. The seed process exits so the database
   is closed, then `snapshot_filesystem()` captures it as an immutable Image.
3. `SandboxPool.fork([...])` creates one sandbox per branch from that snapshot, all at
   once with `asyncio.gather`. Each branch has its own writable app, its own database
   and its own browser.
4. `BranchSandbox` holds the sandbox handle: file read/write (limited to the workspace),
   `get_diff`, `start_app`, `run_browser_check` and `apply_patch`. The agents will get it
   through dependencies, so the model never picks a sandbox ID.
5. Every sandbox ID goes into `runs/active_sandboxes.json` before use. The pool
   terminates every sandbox on exit, whether the run succeeded, failed or was cancelled.
   Modal's `timeout` and `idle_timeout` act as a hard backstop.

Sandboxes get no secrets and use `block_network=True` (localhost only).
