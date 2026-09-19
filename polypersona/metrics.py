from __future__ import annotations

from collections import Counter
from statistics import mean

from .models import SessionReport, VariantMetrics

NEGATIVE = {"bug", "friction", "confusion"}


def _mean(values: list[float]) -> float | None:
    return round(mean(values), 2) if values else None


def backtracks(report: SessionReport) -> int:
    """Back-button presses plus returns to a page visited earlier."""
    count, seen = 0, []
    for step in report.steps:
        if step.action == "go_back":
            count += 1
        elif seen and step.url != seen[-1] and step.url in seen:
            count += 1
        if not seen or seen[-1] != step.url:
            seen.append(step.url)
    return count


def dead_clicks(report: SessionReport) -> int:
    return sum(1 for s in report.steps if s.action == "click" and not s.changed)


def compute_metrics(reports: list[SessionReport]) -> list[VariantMetrics]:
    """Hard numbers per variant. Computed in code so the evaluator interprets rather than invents them."""
    out = []
    for variant in sorted({r.variant_id for r in reports}):
        rs = [r for r in reports if r.variant_id == variant]
        ok = [r for r in rs if r.outcome != "error"]
        obs = [o for r in ok for o in r.observations]
        surveys = [r.exit_survey for r in ok if r.exit_survey]
        out.append(
            VariantMetrics(
                variant_id=variant,
                sessions=len(rs),
                completion_rate=round(sum(r.outcome == "completed" for r in rs) / len(rs), 2),
                mean_steps=_mean([len(r.steps) - 1 for r in ok]) or 0,
                mean_duration_s=_mean([r.duration_s for r in ok]) or 0,
                dead_clicks=sum(dead_clicks(r) for r in ok),
                backtracks=sum(backtracks(r) for r in ok),
                mean_ease=_mean([s.ease for s in surveys]),
                mean_trust=_mean([s.trust for s in surveys]),
                observations_by_kind=dict(Counter(o.kind for o in obs)),
                mean_negative_severity=_mean([o.severity for o in obs if o.kind in NEGATIVE]),
                errors=len(rs) - len(ok),
                input_tokens=sum(r.input_tokens for r in rs),
                output_tokens=sum(r.output_tokens for r in rs),
            )
        )
    return out
