"""Cloud orchestration and the HTTP API. State lives in a modal.Dict so every container sees the same run.

Keys: "index" (run summaries), "<run>/state" (live state), "<run>/<session>/<idx>.jpg",
"<run>/<session>/video", "<run>/<session>/report".
"""

from __future__ import annotations

import os
import secrets
import time
import traceback

from . import evaluator
from .live import DictBackend, LiveBoard
from .models import EvaluatorReport, SessionReport, VariantMetrics
from .orchestrator import Result, RunConfig, judge, plan, run_on_modal, session_ids
from .personas import DEFAULT_PERSONAS, generate_personas


async def _index_update(store, run_id: str, **fields) -> None:
    index = await store.get.aio("index", [])
    for row in index:
        if row["run_id"] == run_id:
            row.update(fields)
            break
    else:
        index.insert(0, {"run_id": run_id, **fields})
    await store.put.aio("index", index[:200])


async def execute(run_id: str, config_json: str, store, run_session_remote) -> None:
    config = RunConfig.model_validate_json(config_json)
    board = None
    try:
        jobs = await plan(config)
        board = LiveBoard(DictBackend(store, run_id), run_id, jobs, session_ids(jobs), "on Modal", config.model_dump())
        await board.flush()
        await _index_update(store, run_id, status="running", sessions=len(jobs))

        async def on_result(result: Result) -> None:
            report, _, video = result
            await store.put.aio(f"{run_id}/{report.session_id}/report", report.model_dump_json())
            if video:
                await store.put.aio(f"{run_id}/{report.session_id}/video", video)
            await board.session_done(report, has_video=bool(video))

        results = await run_on_modal(jobs, board, on_result, run_session_remote)
        metrics, verdict, tokens = await judge(results, board)
        total = sum(r.input_tokens + r.output_tokens for r, _, _ in results) + sum(tokens.values())
        await board.set_status("finished", metrics=[m.model_dump() for m in metrics], verdict=verdict.model_dump() if verdict else None, tokens={**tokens, "total": total})
        await _index_update(store, run_id, status="finished", winner=verdict.winner if verdict else None, confidence=verdict.confidence if verdict else None, tokens=total)
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        print(traceback.format_exc(), flush=True)
        if board:
            await board.set_status("failed", error=message)
        else:
            await store.put.aio(f"{run_id}/state", {"run_id": run_id, "status": "failed", "error": message, "sessions": {}})
        await _index_update(store, run_id, status="failed")


def create_api(store, run_experiment):
    from fastapi import Depends, FastAPI, Header, HTTPException, Response
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    api = FastAPI(title="Polypersona")
    api.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    def authorised(authorization: str = Header(default="")) -> None:
        """Starting runs spends Gemini and Modal money, so writes need the shared token."""
        expected = os.environ.get("POLYPERSONA_TOKEN")
        if not expected:
            raise HTTPException(503, "POLYPERSONA_TOKEN is not configured on the server")
        if not secrets.compare_digest(authorization.removeprefix("Bearer ").strip(), expected):
            raise HTTPException(401, "missing or wrong token")

    async def state_of(run_id: str) -> dict:
        state = await store.get.aio(f"{run_id}/state")
        if state is None:
            raise HTTPException(404, "unknown run")
        return state

    @api.get("/api/health")
    async def health() -> dict:
        return {"ok": True}

    @api.get("/api/auth", dependencies=[Depends(authorised)])
    async def auth() -> dict:
        return {"ok": True}

    @api.get("/api/personas")
    async def personas() -> list[dict]:
        return [p.model_dump() for p in DEFAULT_PERSONAS]

    class GenerateBody(BaseModel):
        audience: str
        n: int = 4

    @api.post("/api/personas/generate", dependencies=[Depends(authorised)])
    async def generate(body: GenerateBody) -> list[dict]:
        return [p.model_dump() for p in await generate_personas(body.audience, min(body.n, 8))]

    @api.get("/api/runs")
    async def list_runs() -> list[dict]:
        return await store.get.aio("index", [])

    @api.post("/api/runs", dependencies=[Depends(authorised)])
    async def start_run(config: RunConfig) -> dict:
        config.repeats = max(1, min(config.repeats, 3))
        config.personas = max(1, min(config.personas, 6))
        run_id = time.strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(2)
        await store.put.aio(f"{run_id}/state", {"run_id": run_id, "status": "starting", "created_at": time.time(), "config": config.model_dump(), "sessions": {}})
        await _index_update(store, run_id, status="starting", created_at=time.time(), config=config.model_dump())
        await run_experiment.spawn.aio(run_id, config.model_dump_json())
        return {"run_id": run_id}

    @api.get("/api/runs/{run_id}")
    async def get_run(run_id: str) -> dict:
        return await state_of(run_id)

    @api.get("/api/runs/{run_id}/sessions/{session_id}")
    async def get_session(run_id: str, session_id: str) -> dict:
        session = (await state_of(run_id))["sessions"].get(session_id)
        if session is None:
            raise HTTPException(404, "unknown session")
        return session

    @api.get("/api/runs/{run_id}/sessions/{session_id}/shots/{idx}.jpg")
    async def shot(run_id: str, session_id: str, idx: int) -> Response:
        image = await store.get.aio(f"{run_id}/{session_id}/{idx}.jpg")
        if image is None:
            raise HTTPException(404, "no such screenshot")
        return Response(image, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000, immutable"})

    @api.get("/api/runs/{run_id}/sessions/{session_id}/video")
    async def video(run_id: str, session_id: str) -> Response:
        data = await store.get.aio(f"{run_id}/{session_id}/video")
        if data is None:
            raise HTTPException(404, "no recording yet")
        return Response(data, media_type="video/webm", headers={"Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "none"})

    class AskBody(BaseModel):
        question: str

    @api.post("/api/runs/{run_id}/ask", dependencies=[Depends(authorised)])
    async def ask(run_id: str, body: AskBody) -> dict:
        state = await state_of(run_id)
        if state["status"] != "finished":
            raise HTTPException(409, "the run has not finished yet")
        reports, shots = [], {}
        for sid, s in state["sessions"].items():
            raw = await store.get.aio(f"{run_id}/{sid}/report")
            if raw is None:
                continue
            report = SessionReport.model_validate_json(raw)
            reports.append(report)
            shots[sid] = [await store.get.aio(f"{run_id}/{sid}/{i}.jpg") or b"" for i in range(len(report.steps))]
        deps = evaluator.EvalDeps(reports=reports, metrics=[VariantMetrics(**m) for m in state.get("metrics") or []], screenshots=shots)
        verdict = EvaluatorReport(**state["verdict"]) if state.get("verdict") else None
        return {"answer": await evaluator.ask(deps, body.question[:1000], verdict)}

    return api
