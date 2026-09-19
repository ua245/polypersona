"""Live view of a run: session events are written under the run directory and served to a polling page."""

from __future__ import annotations

import functools
import json
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .models import Persona, TestTask

PAGE = Path(__file__).with_name("live.html")


class _Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class LiveBoard:
    """Collects events from every session and keeps runs/<id>/live.json current.

    Screenshots and steps reach disk as they happen, so a crashed run still leaves its evidence behind.
    """

    def __init__(self, run_dir: Path, jobs: list[tuple[Persona, TestTask, int]], session_ids: list[str], where: str):
        self.run_dir = run_dir
        self.state = {
            "where": where,
            "status": "running",
            "report": None,
            "verdict": None,
            "sessions": {
                sid: {
                    "session_id": sid,
                    "persona": p.name,
                    "persona_id": p.id,
                    "device": p.device,
                    "savviness": p.tech_savviness,
                    "patience": p.patience_steps,
                    "variant": t.variant_id,
                    "status": "queued",
                    "outcome": None,
                    "steps": [],
                    "observations": [],
                    "actions_left": p.patience_steps,
                    "exit_survey": None,
                    "error": None,
                }
                for sid, (p, t, _) in zip(session_ids, jobs)
            },
        }
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "live.html").write_text(PAGE.read_text())
        self._write()

    def _write(self) -> None:
        tmp = self.run_dir / "live.json.tmp"
        tmp.write_text(json.dumps(self.state))
        os.replace(tmp, self.run_dir / "live.json")  # atomic, so the page never reads half a file

    async def handle(self, event: dict) -> None:
        s = self.state["sessions"].get(event.get("session_id"))
        if not s:
            return
        kind = event["type"]
        if kind == "step":
            step = event["step"]
            d = self.run_dir / "sessions" / s["session_id"]
            d.mkdir(parents=True, exist_ok=True)
            (d / f"{step['idx']}.jpg").write_bytes(event["image"])
            s["status"] = "running"
            s["actions_left"] = event["actions_left"]
            s["steps"].append({k: step[k] for k in ("idx", "action", "args", "reasoning", "changed", "note")})
        elif kind == "observation":
            s["observations"].append(event["observation"])
        elif kind == "finished":
            s.update(status="finished", outcome=event["outcome"], error=event["error"], exit_survey=event["exit_survey"])
        self._write()

    def set_status(self, status: str, **extra) -> None:
        self.state.update(status=status, **extra)
        self._write()

    def serve(self, port: int = 8765) -> str:
        handler = functools.partial(_Handler, directory=str(self.run_dir))
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
