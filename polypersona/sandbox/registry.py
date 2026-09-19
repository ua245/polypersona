"""On-disk record of live sandboxes so cleanup can be retried after a crash."""

import asyncio
import json
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from .config import RUNS_DIR

DEFAULT_REGISTRY_PATH = RUNS_DIR / "active_sandboxes.json"


class SandboxRegistry:
    def __init__(self, path: Path = DEFAULT_REGISTRY_PATH):
        self.path = path
        self._lock = asyncio.Lock()

    def load(self) -> dict[str, dict]:
        try:
            return json.loads(self.path.read_text())
        except FileNotFoundError:
            return {}

    def _save(self, data: dict[str, dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".registry-")
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, sort_keys=True)
        os.replace(tmp, self.path)

    async def add(self, sandbox_id: str, **meta: str) -> None:
        async with self._lock:
            data = self.load()
            data[sandbox_id] = {**meta, "registered_at": datetime.now(UTC).isoformat()}
            self._save(data)

    async def remove(self, sandbox_id: str) -> None:
        async with self._lock:
            data = self.load()
            if data.pop(sandbox_id, None) is not None:
                self._save(data)
