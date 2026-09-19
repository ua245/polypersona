from pathlib import Path

from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_APP_DIR = REPO_ROOT / "demo_app"
SANDBOX_SCRIPTS_DIR = REPO_ROOT / "sandbox_scripts"
SITE_DIR = REPO_ROOT / "sites" / "shop"
RUNS_DIR = REPO_ROOT / "runs"

# Paths inside every sandbox.
REMOTE_APP_DIR = "/workspace/app"
REMOTE_SCRIPTS_DIR = "/opt/polypersona/scripts"
REMOTE_SITE_DIR = "/workspace/site"
REMOTE_ARTIFACTS_DIR = "/tmp/polypersona-artifacts"
APP_PORT = 8000
SITE_PORT = 8080
BROWSER_PORT = 9300


class SandboxSettings(BaseModel):
    app_name: str = "polypersona"
    max_branches: int = Field(default=3, ge=1, le=3)
    # Hard lifetime of each sandbox; Modal kills it after this even if we crash.
    sandbox_timeout_s: int = 30 * 60
    # Terminate a sandbox that has had no exec activity for this long.
    idle_timeout_s: int = 10 * 60
    exec_timeout_s: int = 120
    snapshot_ttl_s: int = 24 * 3600
    cpu: float = 1.0
    memory_mb: int = 2048
    # Repair sandboxes only need localhost; cut them off from the internet.
    block_network: bool = True
    create_attempts: int = 3
