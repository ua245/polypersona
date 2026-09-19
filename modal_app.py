"""Modal side of Polypersona.

- run_session_remote: one isolated container per persona session (agent + Chromium).
- run_experiment:     orchestrates a whole run in the cloud and keeps its live state in a modal.Dict.
- web:                the HTTP API the UI talks to.

Deploy with `uv run modal deploy modal_app.py`.
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("pydantic-ai-slim[google]==2.46.0", "playwright==1.63.0", "python-dotenv", "fastapi[standard]")
    .run_commands("playwright install --with-deps chromium")
    .add_local_dir("site", "/root/site")
    .add_local_python_source("polypersona")
)

app = modal.App("polypersona", image=image)
secrets = [modal.Secret.from_dotenv(__file__)]
runs = modal.Dict.from_name("polypersona-runs", create_if_missing=True)


@app.function(secrets=secrets, timeout=900, max_containers=20)
async def run_session_remote(persona_json: str, task_json: str, repeat: int, events: modal.Queue | None = None, control_key: str | None = None) -> tuple[str, list[bytes], bytes | None]:
    # JSON in and out keeps the boundary independent of local/remote pydantic versions.
    from polypersona.models import Persona, TestTask
    from polypersona.session import run_session

    sink = events.put.aio if events is not None else None  # steps stream out while the session runs

    async def control() -> dict | None:
        """The observer's latest nudge for this agent, taken once."""
        try:
            return await runs.pop.aio(control_key)
        except KeyError:
            return None

    report, shots, video = await run_session(Persona.model_validate_json(persona_json), TestTask.model_validate_json(task_json), repeat, sink=sink, control=control if control_key else None)
    return report.model_dump_json(), shots, video


@app.function(secrets=secrets, timeout=3600)
async def run_experiment(run_id: str, config_json: str) -> None:
    from polypersona.cloud import execute

    await execute(run_id, config_json, runs, run_session_remote)


@app.function(secrets=secrets, min_containers=0, scaledown_window=300)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def web():
    from polypersona.cloud import create_api

    return create_api(runs, run_experiment)
