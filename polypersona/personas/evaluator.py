"""Turns session reports and code-computed metrics into an A/B verdict."""

import json
from dataclasses import dataclass
from pathlib import Path

from pydantic_ai import Agent, BinaryContent, RunContext, ToolReturn
from pydantic_ai.models import Model
from pydantic_ai.usage import RunUsage

from .models import EvaluatorReport, SessionReport, VariantMetrics


@dataclass
class EvalDeps:
    run_dir: Path
    reports: dict[str, SessionReport]


evaluator = Agent(
    deps_type=EvalDeps,
    output_type=EvaluatorReport,
    instructions="""You analyse usability sessions in which people each tried to complete the same
task on one of two versions (A and B) of a website.

Rules:
- The metrics were computed in code and are ground truth. Do not recompute or invent numbers.
- "completed" was verified against the site's database, not taken from the person's word.
- Every issue must cite evidence as "<session_id>#<step_idx>" taken from the data you were given.
- Merge duplicate issues reported by different people into one issue.
- Use view_screenshot when an observation is unclear.
- Be calibrated: with few sessions per variant, say confidence is low. If the evidence is
  mixed, answer "no clear winner".""",
)


@evaluator.tool
async def view_screenshot(ctx: RunContext[EvalDeps], session_id: str, step_idx: int) -> ToolReturn | str:
    """Look at the screenshot a session captured after a given step."""
    report = ctx.deps.reports.get(session_id)
    if not report:
        return f"unknown session {session_id}"
    step = next((s for s in report.steps if s.idx == step_idx), None)
    if not step:
        return f"session {session_id} has no step {step_idx}"
    png = (ctx.deps.run_dir / step.screenshot).read_bytes()
    return ToolReturn(
        return_value=f"{session_id} step {step_idx}: {step.action} on {step.url}",
        content=[BinaryContent(png, media_type="image/png")],
    )


def digest(report: SessionReport) -> dict:
    return {
        "session_id": report.session_id,
        "variant": report.variant,
        "persona": report.persona.model_dump(include={"name", "tech_savviness", "viewport", "reading_style", "patience_steps"}),
        "outcome": report.outcome,
        "error": report.error,
        "steps": [
            {"idx": s.idx, "action": s.action, "intent": s.intent, "url": s.url, "changed": s.changed, "error": s.error}
            for s in report.steps
        ],
        "observations": [o.model_dump(exclude={"screenshot"}) for o in report.observations],
        "exit_survey": report.exit_survey.model_dump() if report.exit_survey else None,
    }


async def evaluate(
    reports: list[SessionReport], metrics: dict[str, VariantMetrics], *, run_dir: Path, model: Model
) -> tuple[EvaluatorReport, RunUsage]:
    payload = {
        "task": "Buy 2 tickets to Jazz Night",
        "metrics": {k: v.model_dump() for k, v in metrics.items()},
        "sessions": [digest(r) for r in reports],
    }
    usage = RunUsage()
    result = await evaluator.run(
        "Here are the sessions and metrics. Produce your report.\n" + json.dumps(payload, default=str),
        deps=EvalDeps(run_dir=run_dir, reports={r.session_id: r for r in reports}),
        model=model,
        usage=usage,
    )
    return result.output, usage
