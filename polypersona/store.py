from __future__ import annotations

import html
import json
from pathlib import Path

from .evaluator import EvalDeps
from .models import EvaluatorReport, SessionReport, VariantMetrics


def save_run(run_dir: Path, results: list[tuple[SessionReport, list[bytes], bytes | None]], metrics: list[VariantMetrics], verdict: EvaluatorReport | None) -> Path:
    for report, shots, video in results:
        d = run_dir / "sessions" / report.session_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "report.json").write_text(report.model_dump_json(indent=1))
        for i, shot in enumerate(shots):
            (d / f"{i}.jpg").write_bytes(shot)
        if video:
            (d / "session.webm").write_bytes(video)
    (run_dir / "metrics.json").write_text(json.dumps([m.model_dump() for m in metrics], indent=1))
    if verdict:
        (run_dir / "verdict.json").write_text(verdict.model_dump_json(indent=1))
    out = run_dir / "report.html"
    out.write_text(render_html([r for r, _, _ in results], metrics, verdict, {r.session_id for r, _, v in results if v}))
    return out


def load_run(run_dir: Path) -> tuple[EvalDeps, EvaluatorReport | None]:
    reports, shots = [], {}
    for d in sorted((run_dir / "sessions").iterdir()):
        report = SessionReport.model_validate_json((d / "report.json").read_text())
        reports.append(report)
        shots[report.session_id] = [(d / f"{i}.jpg").read_bytes() for i in range(len(report.steps))]
    metrics = [VariantMetrics(**m) for m in json.loads((run_dir / "metrics.json").read_text())]
    vp = run_dir / "verdict.json"
    verdict = EvaluatorReport.model_validate_json(vp.read_text()) if vp.exists() else None
    return EvalDeps(reports=reports, metrics=metrics, screenshots=shots), verdict


CSS = """
:root{--bg:#f2f4f3;--card:#fff;--ink:#16211d;--mut:#5d6b66;--line:#d3dbd7;--acc:#0b6e5b;--bad:#b3261e;--warn:#9a5a0b}
@media(prefers-color-scheme:dark){:root{--bg:#0e1513;--card:#161f1c;--ink:#e3ebe8;--mut:#94a59f;--line:#2c3a35;--acc:#57c9ae;--bad:#f2867e;--warn:#e2a455}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif;padding:32px 20px}
.wrap{max-width:1100px;margin:0 auto}h1{font-size:28px;margin:0 0 4px}h2{margin:40px 0 12px;font-size:20px}h3{margin:0;font-size:16px}
.mut{color:var(--mut)}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:18px;margin:12px 0}
.win{border-left:4px solid var(--acc)}.tag{display:inline-block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:99px;border:1px solid var(--line);margin-right:6px}
.tag.bug,.tag.error,.tag.gave_up,.tag.out_of_steps{color:var(--bad);border-color:var(--bad)}.tag.friction,.tag.confusion{color:var(--warn);border-color:var(--warn)}.tag.delight,.tag.completed{color:var(--acc);border-color:var(--acc)}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:7px 12px 7px 0;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--mut);font-weight:600}
.tw{overflow-x:auto}.film{display:flex;gap:12px;overflow-x:auto;padding:6px 0 12px}.frame{flex:0 0 250px;font-size:12px}
.shot{position:relative;border:1px solid var(--line);border-radius:4px;overflow:hidden;line-height:0}.shot img{width:100%}
.dot{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:rgba(227,38,54,.55);border:2px solid #fff;box-shadow:0 0 0 1px #e32636}
.frame p{margin:6px 0 0}.obs{margin:4px 0 0;padding-left:8px;border-left:2px solid var(--line)}ul{margin:6px 0;padding-left:20px}
details summary{cursor:pointer}.rec{display:block;width:100%;max-width:760px;margin:12px 0 4px;border:1px solid var(--line);border-radius:6px;background:#000}.rec.mobile{max-width:280px}
"""


def render_html(reports: list[SessionReport], metrics: list[VariantMetrics], verdict: EvaluatorReport | None, videos: set[str] = frozenset()) -> str:
    e = html.escape
    parts = [f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Polypersona run</title><style>{CSS}</style><div class=wrap>"]
    parts.append(f"<h1>Polypersona run</h1><p class=mut>{len(reports)} sessions · {len({r.persona.id for r in reports})} personas · variants {', '.join(m.variant_id for m in metrics)}</p>")
    if verdict:
        parts.append(f"<div class='card win'><span class=tag>verdict</span><span class=tag>confidence: {verdict.confidence}</span><h3 style='margin-top:8px'>Winner: {e(verdict.winner)}</h3><p>{e(verdict.rationale)}</p>")
        parts.append("<b>Caveats</b><ul>" + "".join(f"<li>{e(c)}</li>" for c in verdict.caveats) + "</ul></div>")
    parts.append("<h2>Metrics (computed in code)</h2><div class='card tw'><table><tr><th>Variant<th>Sessions<th>Completion<th>Mean actions<th>Mean time<th>Dead clicks<th>Backtracks<th>Ease /5<th>Trust /5<th>Neg. severity<th>Observations</tr>")
    for m in metrics:
        kinds = ", ".join(f"{k} {v}" for k, v in m.observations_by_kind.items())
        parts.append(f"<tr><td><b>{e(m.variant_id)}</b><td>{m.sessions}<td>{m.completion_rate:.0%}<td>{m.mean_steps}<td>{m.mean_duration_s}s<td>{m.dead_clicks}<td>{m.backtracks}<td>{m.mean_ease}<td>{m.mean_trust}<td>{m.mean_negative_severity}<td>{e(kinds)}</tr>")
    parts.append("</table></div>")
    if verdict:
        parts.append("<h2>Issues</h2>")
        for i in sorted(verdict.issues, key=lambda i: -i.severity):
            parts.append(f"<div class=card><span class='tag {i.kind}'>{i.kind}</span><span class=tag>variant {e(i.variant_id)}</span><span class=tag>severity {i.severity}</span><h3 style='margin-top:8px'>{e(i.title)}</h3><p><b>{'Keep' if i.kind == 'delight' else 'Fix'}:</b> {e(i.recommendation)}</p><p class=mut>Affected: {e(', '.join(i.affected_personas))} · Evidence: {e(', '.join(i.evidence))}</p></div>")
        parts.append("<h2>By persona</h2><div class=card><ul>" + "".join(f"<li>{e(n)}</li>" for n in verdict.per_persona_notes) + "</ul></div>")
    parts.append("<h2>Sessions</h2>")
    for r in reports:
        p = r.persona
        parts.append(f"<details class=card {'open' if len(reports) <= 2 else ''}><summary><b>{e(p.name)}</b> on variant <b>{e(r.variant_id)}</b> <span class='tag {r.outcome}'>{r.outcome}</span><span class=mut>{len(r.steps) - 1} actions · {r.duration_s}s · {p.device} · {p.tech_savviness} savviness · <code>{e(r.session_id)}</code></span></summary>")
        if r.exit_survey:
            s = r.exit_survey
            parts.append(f"<p>“{e(s.summary)}”</p><p class=mut>Ease {s.ease}/5 · Trust {s.trust}/5 · Would return: {'yes' if s.would_return else 'no'}{' · Biggest problem: ' + e(s.biggest_problem) if s.biggest_problem else ''}</p>")
        if r.error:
            parts.append(f"<pre>{e(r.error)}</pre>")
        if r.session_id in videos:
            parts.append(f"<video class='rec {p.device}' controls preload=metadata src='sessions/{e(r.session_id)}/session.webm'></video><p class=mut>Screen recording of the whole session, including the pauses while the persona thinks. Use the player's speed control to skim.</p>")
        parts.append("<div class=film>")
        for i, s in enumerate(r.steps):
            # a click's dot belongs on the screen the user was looking at, i.e. the previous frame
            nxt = r.steps[i + 1] if i + 1 < len(r.steps) else None
            dot = f"<span class=dot style='left:{nxt.args['x'] / 10}%;top:{nxt.args['y'] / 10}%'></span>" if nxt and "x" in nxt.args else ""
            obs = "".join(f"<div class=obs><span class='tag {o.kind}'>{o.kind} {o.severity}</span>{e(o.text)}</div>" for o in r.observations if o.step_idx == s.idx)
            label = e(s.action + (" “" + s.args["text"] + "”" if "text" in s.args else ""))
            parts.append(f"<div class=frame><div class=shot><img loading=lazy src='sessions/{e(r.session_id)}/{s.idx}.jpg'>{dot}</div><p><b>#{s.idx} {label}</b>{'' if s.changed else ' <span class=mut>(no change)</span>'}</p><p class=mut>{e(s.reasoning)}</p>{obs}</div>")
        parts.append("</div></details>")
    parts.append("</div>")
    return "".join(parts)
