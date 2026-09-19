from __future__ import annotations

import json
import os
from dataclasses import dataclass

from pydantic_ai import Agent, BinaryContent, RunContext, ToolReturn
from pydantic_ai.usage import RunUsage

from .models import EvaluatorReport, SessionReport, VariantMetrics
from .persona_agent import make_model

EVALUATOR_MODEL = os.environ.get("EVALUATOR_MODEL", "gemini-pro-latest")


@dataclass
class EvalDeps:
    reports: list[SessionReport]
    metrics: list[VariantMetrics]
    screenshots: dict[str, list[bytes]]  # session_id -> one image per step


INSTRUCTIONS = """You are a senior UX researcher judging an A/B test of a website flow.
Synthetic users, each playing a persona, attempted the same task on each variant. You receive their session reports and metrics computed in code.

Rules:
- The metrics are ground truth. Never restate a number differently from how it is given.
- Each session states how "completed" was decided (completion_check). Trust a check verified in code; treat a self-reported one with caution and say so.
- Each step's note names what the click landed on. Use it to tell a mis-click from a control that did nothing.
- If the evidence is mixed, the variants trade strengths, or the sample is too thin to separate them, answer "no clear winner" rather than forcing a pick.
- Ground every claim in evidence. Reference it as '<session_id>#<step_idx>'. Use get_screenshot to look at a screen before you rely on a contested or severe observation.
- Merge duplicate observations from different personas into one issue and list everyone affected.
- Separate real defects from persona taste. Say which persona segments each variant serves badly.
- These are simulated users and small samples. Set confidence accordingly and list caveats.
- Write plainly. Recommendations must be specific enough for a designer or engineer to act on."""


def _context(deps: EvalDeps) -> str:
    sessions = []
    for r in deps.reports:
        sessions.append(
            {
                "session_id": r.session_id,
                "variant": r.variant_id,
                "persona": r.persona.model_dump(include={"name", "bio", "tech_savviness", "device", "patience_steps"}),
                "outcome": r.outcome,
                "completion_check": r.completion_check,
                "actions": len(r.steps) - 1,
                "duration_s": r.duration_s,
                "path": [f"{s.idx}: {s.action} {json.dumps(s.args)}{' [' + s.note + ']' if s.note else ''}{'' if s.changed else ' (no change)'} — {s.reasoning}" for s in r.steps],
                "observations": [o.model_dump() for o in r.observations],
                "exit_survey": r.exit_survey.model_dump() if r.exit_survey else None,
                "error": r.error,
            }
        )
    return json.dumps({"metrics": [m.model_dump() for m in deps.metrics], "sessions": sessions}, indent=1)


def _build(output_type) -> Agent[EvalDeps]:
    agent = Agent(make_model(EVALUATOR_MODEL), deps_type=EvalDeps, output_type=output_type, instructions=INSTRUCTIONS, retries=3)

    @agent.tool
    def get_screenshot(ctx: RunContext[EvalDeps], session_id: str, step_idx: int) -> ToolReturn | str:
        """Look at what a user saw after a given step of their session."""
        shots = ctx.deps.screenshots.get(session_id)
        if not shots or not 0 <= step_idx < len(shots):
            return "No such screenshot."
        return ToolReturn(
            return_value=f"Screenshot {session_id}#{step_idx} follows.",
            content=[BinaryContent(data=shots[step_idx], media_type="image/jpeg")],
        )

    return agent


async def evaluate(deps: EvalDeps) -> tuple[EvaluatorReport, RunUsage]:
    usage = RunUsage()
    result = await _build(EvaluatorReport).run(f"Judge this test.\n\n{_context(deps)}", deps=deps, usage=usage)
    return result.output, usage


async def ask(deps: EvalDeps, question: str, verdict: EvaluatorReport | None = None) -> str:
    prior = f"\n\nYour earlier verdict:\n{verdict.model_dump_json(indent=1)}" if verdict else ""
    result = await _build(str).run(f"Answer this question about the test: {question}\n\n{_context(deps)}{prior}", deps=deps)
    return result.output
