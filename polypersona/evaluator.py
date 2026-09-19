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
    objective: str | None = None  # what the site owner is trying to improve


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
- Write plainly. Recommendations must be specific enough for a designer or engineer to act on.
- suggestions: the improvements you would make, most valuable first, three to six of them. Judge each one against the
  owner's objective and the task people were given: say how it serves that goal, not just that it is good practice.
  Rate impact on the objective and effort honestly; prefer high impact and low effort at the top. Every suggestion
  needs evidence from the sessions. Do not suggest things nobody struggled with."""


SINGLE_SITE = """

This study tested ONE website, not two variants. There is no winner to pick:
- Set winner to "single site".
- headline: the single most important thing the site owner should know, in one plain sentence.
- rationale: an overall assessment. Would these people use it, where did they struggle, what did they like.
- confidence: how far the findings can be trusted given the panel size and how much the personas agreed.
- Set variant_id to "a" on every issue. Include what works well as 'delight' issues, not only problems.
- per_persona_notes: one line per persona on how it went for them and why."""


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
    goal = next((r.goal for r in deps.reports if r.goal), "")
    brief = {"task_given_to_each_person": goal, "owner_objective": deps.objective or "not stated: infer it from the task"}
    return json.dumps({"brief": brief, "metrics": [m.model_dump() for m in deps.metrics], "sessions": sessions}, indent=1)


def _build(output_type) -> Agent[EvalDeps]:
    agent = Agent(make_model(EVALUATOR_MODEL), deps_type=EvalDeps, output_type=output_type, retries=3)

    @agent.instructions
    def instructions(ctx: RunContext[EvalDeps]) -> str:
        single = len({r.variant_id for r in ctx.deps.reports}) == 1
        return INSTRUCTIONS.replace("judging an A/B test of a website flow", "reviewing a usability study of a website") + SINGLE_SITE if single else INSTRUCTIONS


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
