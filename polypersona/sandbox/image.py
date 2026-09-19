"""The prepared Modal image every sandbox (baseline, repair, evaluation) starts from."""

import modal

from .config import DEMO_APP_DIR, REMOTE_APP_DIR, REMOTE_SCRIPTS_DIR, REMOTE_SITE_DIR, SANDBOX_SCRIPTS_DIR, SITE_DIR

PLAYWRIGHT_VERSION = "1.63.0"


def build_image() -> modal.Image:
    return (
        modal.Image.debian_slim(python_version="3.12")
        .apt_install("git", "procps")
        .uv_pip_install(
            "fastapi==0.141.1",
            "uvicorn==0.53.0",
            "pydantic>=2.13,<3",
            "httpx==0.28.1",
            "pytest==9.1.1",
            "python-multipart==0.0.32",
            f"playwright=={PLAYWRIGHT_VERSION}",
        )
        # Chromium and its system libraries live in the image, so the browser runs
        # inside each sandbox rather than on the coordinator.
        .run_commands("playwright install --with-deps chromium")
        .env({"SHOP_DB_PATH": f"{REMOTE_APP_DIR}/data/shop.db", "PYTHONDONTWRITEBYTECODE": "1"})
        .add_local_dir(SANDBOX_SCRIPTS_DIR, REMOTE_SCRIPTS_DIR, copy=True)
        # The site the persona agents test; SITE_VARIANT picks A or B at start-up.
        .add_local_dir(SITE_DIR, REMOTE_SITE_DIR, copy=True, ignore=["data", "**/__pycache__"])
        .add_local_dir(DEMO_APP_DIR, REMOTE_APP_DIR, copy=True, ignore=["data", "**/__pycache__", ".venv"])
        # Commit the baseline so each branch can produce its own diff with git.
        .run_commands(
            f"cd {REMOTE_APP_DIR} && git init -q -b main"
            " && git -c user.name=polypersona -c user.email=polypersona@localhost add -A"
            " && git -c user.name=polypersona -c user.email=polypersona@localhost commit -qm baseline"
        )
        .workdir(REMOTE_APP_DIR)
    )
