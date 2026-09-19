"""Modal side of Polypersona: one isolated container per persona session."""

import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("pydantic-ai-slim[google]==2.46.0", "playwright==1.63.0", "python-dotenv")
    .run_commands("playwright install --with-deps chromium")
    .add_local_dir("site", "/root/site")
    .add_local_python_source("polypersona")
)

app = modal.App("polypersona", image=image)


@app.function(secrets=[modal.Secret.from_dotenv(__file__)], timeout=900, max_containers=20)
async def run_session_remote(persona_json: str, task_json: str, repeat: int) -> tuple[str, list[bytes], bytes | None]:
    # JSON in and out keeps the boundary independent of local/remote pydantic versions.
    from polypersona.models import Persona, TestTask
    from polypersona.session import run_session

    report, shots, video = await run_session(Persona.model_validate_json(persona_json), TestTask.model_validate_json(task_json), repeat)
    return report.model_dump_json(), shots, video
