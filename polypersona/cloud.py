"""Cloud orchestration and the HTTP API. State lives in a modal.Dict so every container sees the same run.

Keys: "index" (run summaries), "<run>/state" (live state), "<run>/<session>/<idx>.jpg",
"<run>/<session>/video", "<run>/<session>/report".
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import secrets
import time
import traceback

from . import evaluator
from .live import DictBackend, LiveBoard
from pydantic import BaseModel

from .models import EvaluatorReport, SessionReport, VariantMetrics
from .orchestrator import Result, RunConfig, judge, plan, public_config, run_on_modal, session_ids
from .personas import DEFAULT_PERSONAS, generate_personas
from .population import personas_from_rows


class LoginBody(BaseModel):
    username: str
    password: str


class GenerateBody(BaseModel):
    audience: str
    n: int = 4


class AskBody(BaseModel):
    question: str


class RowsBody(BaseModel):
    rows: list[dict[str, str]]
    row_numbers: list[int] | None = None  # 1-based positions in the uploaded file
    filename: str = "upload"


class GuideBody(BaseModel):
    text: str


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
        board = LiveBoard(DictBackend(store, run_id), run_id, jobs, session_ids(jobs), "on Modal", public_config(config))
        await board.flush()
        await _index_update(store, run_id, status="running", sessions=len(jobs), personas=sorted({p.name for p, _, _ in jobs}), variants=sorted({t.variant_id for _, t, _ in jobs}))

        async def on_result(result: Result) -> None:
            report, _, video = result
            await store.put.aio(f"{run_id}/{report.session_id}/report", report.model_dump_json())
            if video:
                await store.put.aio(f"{run_id}/{report.session_id}/video", video)
            await board.session_done(report, has_video=bool(video))

        results = await run_on_modal(jobs, board, on_result, run_session_remote, run_id)
        metrics, verdict, tokens = await judge(results, board, config.objective)
        total = sum(r.input_tokens + r.output_tokens for r, _, _ in results) + sum(tokens.values())
        await board.set_status("finished", metrics=[m.model_dump() for m in metrics], verdict=verdict.model_dump() if verdict else None, tokens={**tokens, "total": total})
        surveys = [r.exit_survey for r, _, _ in results if r.exit_survey]
        await _index_update(
            store, run_id, completed=sum(r.outcome == "completed" for r, _, _ in results),
            sentiment=round(sum(s.ease + s.trust for s in surveys) / (10 * len(surveys)), 2) if surveys else None,
        )
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

    api = FastAPI(title="Polypersona")
    api.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    # No limit unless POLYPERSONA_DAILY_RUNS is set. Useful once a link is shared widely, since every test spends credit.
    DAILY_RUNS_PER_USER = int(os.environ.get("POLYPERSONA_DAILY_RUNS", "0") or 0)

    def _users() -> dict[str, str]:
        """POLYPERSONA_USERS="name:password,name2:password2"."""
        pairs = (item.split(":", 1) for item in os.environ.get("POLYPERSONA_USERS", "").split(",") if ":" in item)
        return {name.strip(): password.strip() for name, password in pairs}

    def _sign(payload: str) -> str:
        return hmac.new(os.environ["POLYPERSONA_TOKEN"].encode(), payload.encode(), hashlib.sha256).hexdigest()

    def authorised(authorization: str = Header(default="")) -> str:
        """Starting runs spends Gemini and Modal money, so writes need a login session or the master token. Returns the user."""
        master = os.environ.get("POLYPERSONA_TOKEN")
        if not master:
            raise HTTPException(503, "POLYPERSONA_TOKEN is not configured on the server")
        token = authorization.removeprefix("Bearer ").strip()
        if secrets.compare_digest(token, master):
            return "owner"
        user, _, rest = token.partition(".")
        expiry, _, signature = rest.partition(".")
        if user in _users() and expiry.isdigit() and int(expiry) > time.time() and secrets.compare_digest(signature, _sign(f"{user}.{expiry}")):
            return user
        raise HTTPException(401, "sign in again")

    @api.post("/api/login")
    async def login(body: LoginBody) -> dict:
        expected = _users().get(body.username.strip())
        if not os.environ.get("POLYPERSONA_TOKEN") or expected is None or not secrets.compare_digest(body.password, expected):
            await asyncio.sleep(1)  # slow down guessing
            raise HTTPException(401, "wrong username or password")
        expiry = int(time.time()) + 7 * 24 * 3600
        payload = f"{body.username.strip()}.{expiry}"
        return {"token": f"{payload}.{_sign(payload)}", "user": body.username.strip(), "expires_at": expiry}

    async def state_of(run_id: str) -> dict:
        state = await store.get.aio(f"{run_id}/state")
        if state is None:
            raise HTTPException(404, "unknown run")
        return state

    @api.get("/api/health")
    async def health() -> dict:
        return {"ok": True}

    @api.get("/api/auth")
    async def auth(user: str = Depends(authorised)) -> dict:
        return {"ok": True, "user": user}

    @api.get("/api/personas")
    async def personas() -> list[dict]:
        return [p.model_dump() for p in DEFAULT_PERSONAS]

    @api.post("/api/personas/generate", dependencies=[Depends(authorised)])
    async def generate(body: GenerateBody) -> list[dict]:
        return [p.model_dump() for p in await generate_personas(body.audience, min(body.n, 8))]

    @api.post("/api/personas/from-rows", dependencies=[Depends(authorised)])
    async def from_rows(body: RowsBody) -> dict:
        """Personas from rows of customer data. Known columns are mapped in code; anything else is personified by Gemini."""
        if not body.rows:
            raise HTTPException(422, "no rows")
        personas, method = await personas_from_rows(body.rows, body.row_numbers, body.filename[:80])
        return {"method": method, "personas": [p.model_dump() for p in personas]}

    @api.get("/api/runs")
    async def list_runs() -> list[dict]:
        return await store.get.aio("index", [])

    @api.post("/api/runs")
    async def start_run(config: RunConfig, user: str = Depends(authorised)) -> dict:
        quota_key = f"quota/{user}/{time.strftime('%Y%m%d')}"
        used = await store.get.aio(quota_key, 0)
        if DAILY_RUNS_PER_USER and user != "owner" and used >= DAILY_RUNS_PER_USER:
            raise HTTPException(429, f"daily limit of {DAILY_RUNS_PER_USER} runs reached for {user}")
        await store.put.aio(quota_key, used + 1)
        config.repeats = max(1, min(config.repeats, 3))
        config.personas = max(1, min(config.personas, 6))
        config.name = (config.name or "").strip()[:80] or None
        config.objective = (config.objective or "").strip()[:300] or None
        config.access_headers = {k.strip()[:60]: v.strip()[:200] for k, v in list((config.access_headers or {}).items())[:3] if k.strip() and v.strip()} or None
        run_id = time.strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(2)
        await store.put.aio(f"{run_id}/state", {"run_id": run_id, "status": "starting", "created_at": time.time(), "config": public_config(config), "sessions": {}})
        await _index_update(store, run_id, status="starting", created_at=time.time(), config=public_config(config), started_by=user, name=config.name)
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
    async def video(run_id: str, session_id: str, range: str = Header(default="")) -> Response:
        data = await store.get.aio(f"{run_id}/{session_id}/video")
        if data is None:
            raise HTTPException(404, "no recording yet")
        headers = {"Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes"}
        if range.startswith("bytes="):  # browsers need byte ranges to seek in a video
            first, _, last = range.removeprefix("bytes=").split(",")[0].partition("-")
            start = int(first) if first else max(0, len(data) - int(last or 0))
            end = min(int(last), len(data) - 1) if first and last else len(data) - 1
            if start > end:
                raise HTTPException(416, "range not satisfiable")
            headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
            return Response(data[start : end + 1], status_code=206, media_type="video/webm", headers=headers)
        return Response(data, media_type="video/webm", headers=headers)

    async def _control(run_id: str, session_id: str, message: dict) -> dict:
        session = (await state_of(run_id))["sessions"].get(session_id)
        if session is None:
            raise HTTPException(404, "unknown agent")
        if session["status"] == "finished":
            raise HTTPException(409, "this agent has already finished")
        await store.put.aio(f"{run_id}/{session_id}/control", message)  # the agent picks it up after its next action
        return {"ok": True}

    @api.post("/api/runs/{run_id}/sessions/{session_id}/guide", dependencies=[Depends(authorised)])
    async def guide(run_id: str, session_id: str, body: GuideBody) -> dict:
        text = body.text.strip()[:300]
        if not text:
            raise HTTPException(422, "say what the agent should try")
        return await _control(run_id, session_id, {"guide": text})

    @api.post("/api/runs/{run_id}/sessions/{session_id}/stop", dependencies=[Depends(authorised)])
    async def stop(run_id: str, session_id: str) -> dict:
        return await _control(run_id, session_id, {"stop": True})

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
        deps = evaluator.EvalDeps(reports=reports, metrics=[VariantMetrics(**m) for m in state.get("metrics") or []], screenshots=shots, objective=(state.get("config") or {}).get("objective"))
        verdict = EvaluatorReport(**state["verdict"]) if state.get("verdict") else None
        return {"answer": await evaluator.ask(deps, body.question[:1000], verdict)}

    return api
