"""Local dashboard: start runs and watch every persona session live.

    uv run python -m polypersona.web          # http://127.0.0.1:8765

Bound to localhost only. Reads everything from runs/<run_id>/, so finished runs replay too.
"""

import asyncio
import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from polypersona.sandboxed.fixtures import PERSONAS
from polypersona.sandboxed.orchestrator import RunConfig, execute_run, new_run_id
from polypersona.sandbox.config import RUNS_DIR

log = logging.getLogger(__name__)
app = FastAPI(title="PolyPersona")
STATIC = Path(__file__).parent / "static"
ACTIVE: dict[str, asyncio.Task] = {}


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _run_dir(run_id: str) -> Path:
    d = (RUNS_DIR / run_id).resolve()
    if d.parent != RUNS_DIR.resolve() or not (d / "run.json").exists():
        raise HTTPException(404, "run not found")
    return d


@app.get("/", response_class=HTMLResponse)
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/personas")
def personas():
    return [p.model_dump() for p in PERSONAS]


@app.get("/api/runs")
def list_runs():
    runs = []
    for d in sorted(RUNS_DIR.glob("*/run.json"), reverse=True):
        r = _read(d)
        if r:
            runs.append({k: r.get(k) for k in ("run_id", "status", "created_at", "model")} | {"live": r["run_id"] in ACTIVE})
    return runs


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    d = _run_dir(run_id)
    run = _read(d / "run.json")
    run["live"] = run_id in ACTIVE
    run["sessions"] = [_read(d / "sessions" / sid / "session.json") for sid in run["session_ids"]]
    return run


@app.get("/files/{run_id}/{path:path}")
def run_file(run_id: str, path: str):
    d = _run_dir(run_id)
    f = (d / path).resolve()
    if not f.is_relative_to(d) or f.suffix != ".png" or not f.is_file():
        raise HTTPException(404, "file not found")
    return FileResponse(f, headers={"Cache-Control": "max-age=3600"})


@app.post("/api/runs")
async def start_run(config: RunConfig):
    if ACTIVE:
        raise HTTPException(409, "a run is already in progress")
    unknown = set(config.persona_ids) - {p.id for p in PERSONAS}
    if unknown or not config.persona_ids:
        raise HTTPException(400, f"unknown personas: {sorted(unknown)}")
    config.repeats = max(1, min(config.repeats, 5))
    config.max_parallel = max(1, min(config.max_parallel, 10))
    run_id = new_run_id()
    task = asyncio.create_task(execute_run(run_id, config))
    ACTIVE[run_id] = task
    task.add_done_callback(lambda t: ACTIVE.pop(run_id, None))
    return {"run_id": run_id}


@app.post("/api/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    task = ACTIVE.get(run_id)
    if not task:
        raise HTTPException(404, "run is not active")
    task.cancel()
    return {"cancelling": run_id}
