"""A/B numbers computed in plain code. The evaluator explains these; it never produces them."""

from collections import Counter
from statistics import mean, median

from .models import SessionReport, VariantMetrics


def backtracks(report: SessionReport) -> int:
    """Back-button presses plus returns to a page visited earlier (excluding reloads)."""
    count = 0
    seen: list[str] = []
    for step in report.steps:
        if step.action == "back":
            count += 1
        elif seen and step.url != seen[-1] and step.url in seen:
            count += 1
        if not seen or seen[-1] != step.url:
            seen.append(step.url)
    return count


def dead_clicks(report: SessionReport) -> int:
    return sum(1 for s in report.steps if s.action == "click" and not s.changed)


def variant_metrics(reports: list[SessionReport], variant: str) -> VariantMetrics:
    rs = [r for r in reports if r.variant == variant and r.status == "finished"]
    done = [r for r in rs if r.outcome == "completed"]
    eases = [r.exit_survey.ease_1_to_5 for r in rs if r.exit_survey]
    kinds = Counter(o.kind for r in rs for o in r.observations)
    return VariantMetrics(
        variant=variant,  # type: ignore[arg-type]
        sessions=len(rs),
        completed=len(done),
        completion_rate=round(len(done) / len(rs), 3) if rs else 0.0,
        median_steps_to_complete=median(len(r.steps) for r in done) if done else None,
        median_duration_s=median(r.duration_s for r in rs if r.duration_s is not None) if rs else None,
        mean_ease=round(mean(eases), 2) if eases else None,
        backtracks=sum(backtracks(r) for r in rs),
        dead_clicks=sum(dead_clicks(r) for r in rs),
        errors=sum(1 for r in rs if r.outcome == "error"),
        observations_by_kind=dict(kinds),
    )


def compute(reports: list[SessionReport]) -> dict[str, VariantMetrics]:
    return {v: variant_metrics(reports, v) for v in ("A", "B")}
