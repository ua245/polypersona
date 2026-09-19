"""Live state of a run. Session events update it as they happen; a backend decides where it is kept."""

from __future__ import annotations

import functools
import json
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Protocol

from .models import Persona, TestTask

PAGE = Path(__file__).with_name("live.html")


class Backend(Protocol):
    async def write_state(self, state: dict) -> None: ...
    async def write_shot(self, session_id: str, idx: int, image: bytes) -> None: ...


class FsBackend:
    """runs/<id>/live.json plus one jpg per step. Used by the CLI."""

    def __init__(self, run_dir: Path):
        self.run_dir = run_dir
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "live.html").write_text(PAGE.read_text())

    async def write_state(self, state: dict) -> None:
        tmp = self.run_dir / "live.json.tmp"
        tmp.write_text(json.dumps(state))
        os.replace(tmp, self.run_dir / "live.json")  # atomic, so the page never reads half a file

    async def write_shot(self, session_id: str, idx: int, image: bytes) -> None:
        d = self.run_dir / "sessions" / session_id
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{idx}.jpg").write_bytes(image)

    def serve(self, port: int = 8765) -> str:
        class Handler(SimpleHTTPRequestHandler):
            def log_message(self, *args) -> None:
                pass

            def end_headers(self) -> None:
                self.send_header("Cache-Control", "no-store")
                super().end_headers()

        handler = functools.partial(Handler, directory=str(self.run_dir))
        for candidate in range(port, port + 20):
            try:
                server = ThreadingHTTPServer(("127.0.0.1", candidate), handler)
                break
            except OSError:
                continue
        else:
            raise RuntimeError("no free port for the live view")
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return f"http://127.0.0.1:{server.server_address[1]}/live.html"


class DictBackend:
    """A modal.Dict shared by the cloud orchestrator and the web API."""

    def __init__(self, store, run_id: str):
        self.store, self.run_id = store, run_id

    async def write_state(self, state: dict) -> None:
        await self.store.put.aio(f"{self.run_id}/state", state)

    async def write_shot(self, session_id: str, idx: int, image: bytes) -> None:
        await self.store.put.aio(f"{self.run_id}/{session_id}/{idx}.jpg", image)


class LiveBoard:
    def __init__(self, backend: Backend, run_id: str, jobs: list[tuple[Persona, TestTask, int]], session_ids: list[str], where: str, config: dict | None = None):
        self.backend = backend
        self.state = {
            "run_id": run_id,
            "created_at": time.time(),
            "where": where,
            "status": "running",
            "config": config or {},
            "report": None,
            "metrics": None,
            "verdict": None,
            "tokens": None,
            "error": None,
            "sessions": {
                sid: {
                    "session_id": sid,
                    "persona": p.name,
                    "persona_id": p.id,
                    "bio": p.bio,
                    "device": p.device,
                    "savviness": p.tech_savviness,
                    "reading_style": p.reading_style,
                    "patience": p.patience_steps,
                    "variant": t.variant_id,
                    "repeat": r,
                    "goal": t.goal,
                    "status": "queued",
                    "outcome": None,
                    "steps": [],
                    "observations": [],
                    "actions_left": p.patience_steps,
                    "exit_survey": None,
                    "has_video": False,
                    "duration_s": None,
                    "tokens": None,
                    "error": None,
                }
                for sid, (p, t, r) in zip(session_ids, jobs)
            },
        }

    async def flush(self) -> None:
        await self.backend.write_state(self.state)

    async def handle(self, event: dict) -> None:
        s = self.state["sessions"].get(event.get("session_id"))
        if not s:
            return
        kind = event["type"]
        if kind == "step":
            step = event["step"]
            await self.backend.write_shot(s["session_id"], step["idx"], event["image"])
            s["status"] = "running"
            s["actions_left"] = event["actions_left"]
            s["steps"].append({k: step[k] for k in ("idx", "action", "args", "reasoning", "changed", "note", "url", "ts")})
        elif kind == "observation":
            s["observations"].append(event["observation"])
        elif kind == "finished":
            s.update(status="finished", outcome=event["outcome"], error=event["error"], exit_survey=event["exit_survey"])
        await self.flush()

    async def session_done(self, report, has_video: bool) -> None:
        s = self.state["sessions"].get(report.session_id)
        if s:
            s.update(status="finished", outcome=report.outcome, has_video=has_video, duration_s=report.duration_s, tokens=report.input_tokens + report.output_tokens, error=report.error)
            await self.flush()

    async def set_status(self, status: str, **extra) -> None:
        self.state.update(status=status, **extra)
        await self.flush()
