from __future__ import annotations

from collections import Counter
from statistics import mean

from .models import SessionReport, VariantMetrics

NEGATIVE = {"bug", "friction", "confusion"}


def _mean(values: list[float]) -> float | None:
    return round(mean(values), 2) if values else None


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
                dead_clicks=sum(1 for r in ok for s in r.steps if s.action == "click" and not s.changed),
                backtracks=sum(1 for r in ok for s in r.steps if s.action == "go_back"),
                mean_ease=_mean([s.ease for s in surveys]),
                mean_trust=_mean([s.trust for s in surveys]),
                observations_by_kind=dict(Counter(o.kind for o in obs)),
                mean_negative_severity=_mean([o.severity for o in obs if o.kind in NEGATIVE]),
            )
        )
    return out
