"""Writes every session's progress to disk as it happens, for the dashboard and for replay."""

import asyncio
import json
import os
import tempfile
from pathlib import Path

from pydantic import BaseModel

from .models import SessionReport


def write_json_atomic(path: Path, data: BaseModel | dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = data.model_dump_json(indent=2) if isinstance(data, BaseModel) else json.dumps(data, indent=2, default=str)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    with os.fdopen(fd, "w") as f:
        f.write(text)
    os.replace(tmp, path)


class SessionRecorder:
    def __init__(self, run_dir: Path, report: SessionReport):
        self.run_dir = run_dir
        self.dir = run_dir / "sessions" / report.session_id
        self.report = report
        self._lock = asyncio.Lock()

    def rel(self, path: Path) -> str:
        return str(path.relative_to(self.run_dir))

    async def save(self) -> None:
        async with self._lock:
            write_json_atomic(self.dir / "session.json", self.report)

    async def append_step_log(self, entry: dict) -> None:
        async with self._lock:
            self.dir.mkdir(parents=True, exist_ok=True)
            with open(self.dir / "steps.jsonl", "a") as f:
                f.write(json.dumps(entry, default=str) + "\n")
