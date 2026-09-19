"""Lifecycle of the isolated Modal sandboxes that repair agents and evaluators run in.

One run looks like this:

1. A baseline sandbox starts from the prepared image, seeds the SQLite database and
   exits the seeding process, so the database file is closed.
2. Its filesystem is snapshotted into an immutable Image and the baseline is terminated.
3. Every branch (repair or evaluation) gets its own sandbox created from that snapshot.
   Each one has its own writable copy of the app, its own database and its own browser.

No credentials are passed into any sandbox. Every sandbox ID is written to the registry
before use and removed only after it has been terminated.
"""

import asyncio
import json
import logging
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import modal
from pydantic import BaseModel

from .config import (
    APP_PORT,
    REMOTE_APP_DIR,
    REMOTE_ARTIFACTS_DIR,
    REMOTE_SCRIPTS_DIR,
    RUNS_DIR,
    SandboxSettings,
)
from .image import build_image
from .paths import resolve_workspace_path
from .redact import redact
from .registry import SandboxRegistry
from .retry import with_retry

log = logging.getLogger(__name__)

Role = Literal["baseline", "repair", "eval", "session"]
MAX_OUTPUT_CHARS = 20_000


class ExecResult(BaseModel):
    command: list[str]
    exit_code: int
    stdout: str
    stderr: str
    started_at: datetime
    duration_s: float
    timed_out: bool


class BrowserCheckResult(BaseModel):
    ok: bool
    observations: list[str]
    orders_after_buy: int | None
    orders_after_retry: int | None
    # Local paths of the screenshots, copied out of the sandbox.
    screenshots: list[str]
    raw_exit_code: int


def _clip(text: str) -> str:
    text = redact(text)
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + f"\n... [truncated {len(text) - MAX_OUTPUT_CHARS} chars]"
    return text


class BranchSandbox:
    """One isolated sandbox bound to a single run and branch.

    Agent tools receive an instance of this class through their dependencies,
    so the model never sees or chooses a sandbox ID.
    """

    def __init__(
        self,
        *,
        run_id: str,
        branch_id: str,
        role: Role,
        sandbox: modal.Sandbox,
        settings: SandboxSettings,
        artifacts_dir: Path,
    ):
        self.run_id = run_id
        self.branch_id = branch_id
        self.role = role
        self.sandbox = sandbox
        self.settings = settings
        self.artifacts_dir = artifacts_dir
        self.terminated = False
        self._browser_checks = 0

    @property
    def sandbox_id(self) -> str:
        return self.sandbox.object_id

    async def exec(self, *args: str, timeout_s: int | None = None, workdir: str = REMOTE_APP_DIR) -> ExecResult:
        """Run a fixed, backend-chosen command. Not exposed to agents as a raw shell."""
        timeout_s = timeout_s or self.settings.exec_timeout_s
        started = datetime.now(UTC)
        t0 = time.monotonic()
        proc = await self.sandbox.exec.aio(*args, timeout=timeout_s, workdir=workdir)
        stdout, stderr = await asyncio.gather(proc.stdout.read.aio(), proc.stderr.read.aio())
        code = await proc.wait.aio()
        return ExecResult(
            command=list(args),
            exit_code=code,
            stdout=_clip(stdout),
            stderr=_clip(stderr),
            started_at=started,
            duration_s=round(time.monotonic() - t0, 3),
            # Modal reports an exec that hit its deadline with exit code -1.
            timed_out=code == -1,
        )

    # --- workspace file operations (paths validated against the app workspace) ---

    async def list_files(self) -> list[str]:
        res = await self.exec("git", "ls-files", "--cached", "--others", "--exclude-standard")
        if res.exit_code != 0:
            raise RuntimeError(f"list_files failed: {res.stderr}")
        return sorted(line for line in res.stdout.splitlines() if line)

    async def read_file(self, relative_path: str) -> str:
        return await self.sandbox.filesystem.read_text.aio(resolve_workspace_path(relative_path))

    async def write_file(self, relative_path: str, content: str) -> None:
        path = resolve_workspace_path(relative_path)
        parent = path.rsplit("/", 1)[0]
        if parent != REMOTE_APP_DIR:
            await self.sandbox.filesystem.make_directory.aio(parent, create_parents=True)
        await self.sandbox.filesystem.write_text.aio(content, path)

    async def get_diff(self) -> str:
        # Mark new files as intent-to-add so they appear in the diff too.
        await self.exec("git", "add", "--intent-to-add", "--all")
        res = await self.exec("git", "diff", "--no-color", "--no-ext-diff", "HEAD")
        if res.exit_code != 0:
            raise RuntimeError(f"git diff failed: {res.stderr}")
        return res.stdout

    async def apply_patch(self, patch: str) -> ExecResult:
        """Apply a unified diff to this sandbox's workspace (used for fresh evaluation sandboxes)."""
        remote = f"{REMOTE_ARTIFACTS_DIR}/candidate.patch"
        await self.sandbox.filesystem.make_directory.aio(REMOTE_ARTIFACTS_DIR, create_parents=True)
        await self.sandbox.filesystem.write_text.aio(patch, remote)
        return await self.exec("git", "apply", "--whitespace=nowarn", remote)

    # --- demo app lifecycle ---

    async def reset_db(self) -> ExecResult:
        return await self.exec("python", "-m", "app.seed")

    async def start_app(self, *, ready_timeout_s: int = 30) -> ExecResult:
        await self.stop_app()
        cmd = (
            f"cd {REMOTE_APP_DIR} && nohup python -m uvicorn app.main:app "
            f"--host 127.0.0.1 --port {APP_PORT} > /tmp/app.log 2>&1 &"
        )
        await self.exec("sh", "-c", cmd)
        res = await self.exec(
            "python",
            f"{REMOTE_SCRIPTS_DIR}/wait_http.py",
            f"http://127.0.0.1:{APP_PORT}/api/health",
            str(ready_timeout_s),
            timeout_s=ready_timeout_s + 10,
        )
        if res.exit_code != 0:
            app_log = await self.exec("tail", "-n", "50", "/tmp/app.log")
            res.stderr += "\n--- app log ---\n" + app_log.stdout
        return res

    async def stop_app(self) -> None:
        await self.exec("pkill", "-f", "uvicorn app.main:app")

    async def run_browser_check(self) -> BrowserCheckResult:
        """Run the predefined Playwright checkout journey inside this sandbox."""
        self._browser_checks += 1
        remote_dir = f"{REMOTE_ARTIFACTS_DIR}/browser/{self._browser_checks:02d}"
        res = await self.exec(
            "python",
            f"{REMOTE_SCRIPTS_DIR}/browser_check.py",
            f"http://127.0.0.1:{APP_PORT}/",
            remote_dir,
            timeout_s=90,
        )
        try:
            data = json.loads(res.stdout.strip().splitlines()[-1])
        except (IndexError, json.JSONDecodeError):
            data = {"ok": False, "observations": [f"browser check produced no result: {res.stderr[-2000:]}"]}

        local_dir = self.artifacts_dir / "screenshots" / f"{self._browser_checks:02d}"
        local_dir.mkdir(parents=True, exist_ok=True)
        local_shots = []
        for remote in data.get("screenshots", []):
            local = local_dir / Path(remote).name
            await self.sandbox.filesystem.copy_to_local.aio(remote, local)
            local_shots.append(str(local))

        return BrowserCheckResult(
            ok=bool(data.get("ok")),
            observations=[redact(o) for o in data.get("observations", [])],
            orders_after_buy=data.get("orders_after_buy"),
            orders_after_retry=data.get("orders_after_retry"),
            screenshots=local_shots,
            raw_exit_code=res.exit_code,
        )

    async def is_running(self) -> bool:
        return await self.sandbox.poll.aio() is None

    async def terminate(self) -> None:
        if self.terminated:
            return
        await with_retry(lambda: self.sandbox.terminate.aio(wait=True), what=f"terminate {self.sandbox_id}")
        self.terminated = True


class SandboxPool:
    """Creates and always cleans up every sandbox belonging to one run.

    Use as an async context manager: all sandboxes are terminated on exit,
    whether the run succeeded, failed or was cancelled.
    """

    def __init__(
        self,
        run_id: str,
        *,
        settings: SandboxSettings | None = None,
        registry: SandboxRegistry | None = None,
        runs_dir: Path = RUNS_DIR,
    ):
        self.run_id = run_id
        self.settings = settings or SandboxSettings()
        self.registry = registry or SandboxRegistry()
        self.run_dir = runs_dir / run_id
        self.branches: dict[str, BranchSandbox] = {}
        self.baseline_image: modal.Image | None = None
        self._app: modal.App | None = None

    async def __aenter__(self) -> "SandboxPool":
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self._app = await modal.App.lookup.aio(self.settings.app_name, create_if_missing=True)
        return self

    async def __aexit__(self, *exc_info) -> None:
        await self.terminate_all()

    async def _create(self, *, branch_id: str, role: Role, image: modal.Image) -> BranchSandbox:
        s = self.settings

        async def create() -> modal.Sandbox:
            return await modal.Sandbox.create.aio(
                app=self._app,
                image=image,
                timeout=s.sandbox_timeout_s,
                idle_timeout=s.idle_timeout_s,
                workdir=REMOTE_APP_DIR,
                cpu=s.cpu,
                memory=s.memory_mb,
                block_network=s.block_network,
                tags={"project": s.app_name, "run_id": self.run_id, "branch_id": branch_id, "role": role},
            )

        sb = await with_retry(create, what=f"create sandbox {branch_id}", attempts=s.create_attempts)
        # Register as soon as the ID exists so cleanup can find it after a crash.
        await self.registry.add(sb.object_id, run_id=self.run_id, branch_id=branch_id, role=role)
        branch = BranchSandbox(
            run_id=self.run_id,
            branch_id=branch_id,
            role=role,
            sandbox=sb,
            settings=s,
            artifacts_dir=self.run_dir / branch_id,
        )
        self.branches[branch_id] = branch
        log.info("run %s: %s sandbox %s -> %s", self.run_id, role, branch_id, sb.object_id)
        return branch

    async def prepare_baseline(self) -> modal.Image:
        """Build the seeded baseline once and snapshot it so every branch starts identical."""
        if self.baseline_image is not None:
            return self.baseline_image
        baseline = await self._create(branch_id="baseline", role="baseline", image=build_image())
        try:
            seeded = await baseline.reset_db()
            if seeded.exit_code != 0:
                raise RuntimeError(f"seeding baseline failed: {seeded.stderr}")
            # The seed process has exited, so no connection holds the SQLite file open.
            self.baseline_image = await baseline.sandbox.snapshot_filesystem.aio(ttl=self.settings.snapshot_ttl_s)
        finally:
            await self._terminate(baseline)
        return self.baseline_image

    async def fork(self, branch_ids: list[str], *, role: Role = "repair") -> list[BranchSandbox]:
        """Create one isolated sandbox per branch, concurrently, from the baseline snapshot."""
        if not branch_ids or len(branch_ids) > self.settings.max_branches:
            raise ValueError(f"need 1..{self.settings.max_branches} branches, got {len(branch_ids)}")
        if dup := set(branch_ids) & set(self.branches):
            raise ValueError(f"branch ids already in use: {sorted(dup)}")
        image = await self.prepare_baseline()
        results = await asyncio.gather(
            *(self._create(branch_id=b, role=role, image=image) for b in branch_ids),
            return_exceptions=True,
        )
        errors = [r for r in results if isinstance(r, BaseException)]
        if errors:
            # Anything that was created is already tracked in self.branches and is
            # terminated by __aexit__.
            raise errors[0]
        return list(results)  # type: ignore[arg-type]

    async def create_eval_sandbox(self, branch_id: str) -> BranchSandbox:
        """A fresh sandbox from the untouched baseline, for trusted evaluation."""
        image = await self.prepare_baseline()
        return await self._create(branch_id=branch_id, role="eval", image=image)

    async def create_session_sandbox(self, session_id: str) -> BranchSandbox:
        """A fresh sandbox for one persona session. Callers cap concurrency themselves."""
        if session_id in self.branches:
            raise ValueError(f"session id already in use: {session_id}")
        image = await self.prepare_baseline()
        return await self._create(branch_id=session_id, role="session", image=image)

    async def release(self, branch: BranchSandbox) -> None:
        """Terminate one sandbox as soon as its work is done, instead of at run end."""
        await self._terminate(branch)

    async def _terminate(self, branch: BranchSandbox) -> None:
        try:
            await branch.terminate()
            await self.registry.remove(branch.sandbox_id)
        except Exception:
            log.exception("failed to terminate %s (%s); left in registry for cleanup", branch.branch_id, branch.sandbox_id)

    async def terminate_all(self) -> None:
        # Shielded so cancellation of the run cannot interrupt cleanup halfway.
        live = [b for b in self.branches.values() if not b.terminated]
        if live:
            await asyncio.shield(asyncio.gather(*(self._terminate(b) for b in live)))


async def cleanup_registered(registry: SandboxRegistry | None = None) -> list[str]:
    """Terminate every sandbox still listed in the registry (for crash recovery)."""
    registry = registry or SandboxRegistry()
    cleaned = []
    for sandbox_id in list(registry.load()):
        try:
            sb = await modal.Sandbox.from_id.aio(sandbox_id)
            await sb.terminate.aio()
        except modal.exception.NotFoundError:
            pass
        await registry.remove(sandbox_id)
        cleaned.append(sandbox_id)
    return cleaned


async def cleanup_tagged(app_name: str = "polypersona") -> list[str]:
    """Terminate every running sandbox tagged with this project, registered or not."""
    cleaned = []
    async for sb in modal.Sandbox.list.aio(tags={"project": app_name}):
        await sb.terminate.aio()
        cleaned.append(sb.object_id)
    return cleaned

