// Test reports for download: the same content as Markdown, or as a print-ready document the browser
// saves as PDF. Everything comes from the recorded run; nothing is invented here.
import { fmtTime, sessionList, shotUrl, type Issue, type RunState, type SessionState, type Suggestion, type VariantMetrics } from './api';
import { isSingleSite, pct, testName, variantName, verdictLabel } from './derive';

const OUTCOME: Record<string, string> = { completed: 'Reached the goal', gave_up: 'Gave up', out_of_steps: 'Ran out of patience', error: 'Session crashed' };
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const num = (v: number | null | undefined, digits = 1) => (v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(digits));
const secs = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)} s`);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'report';
export const reportFileName = (run: RunState, ext: 'md' | 'pdf') => `polypersona-${slug(testName(run))}-${run.run_id}.${ext}`;

interface Model {
  title: string; date: string; runId: string; single: boolean; headline: string; verdict: string; confidence: string; rationale: string;
  details: [string, string][]; metrics: VariantMetrics[]; suggestions: Suggestion[]; issues: Issue[]; notes: string[]; caveats: string[];
  sessions: SessionState[]; label: (v: string) => string;
}

function model(run: RunState): Model {
  const v = run.verdict!;
  const single = isSingleSite(run);
  const sessions = sessionList(run);
  const c = run.config;
  const label = (id: string) => variantName(id, c);
  const details: [string, string][] = [
    ['Test ID', run.run_id],
    ['Date', fmtTime(run.created_at)],
    ...(c.url_a ? [[single ? 'Site' : 'Variant A', c.url_a] as [string, string]] : []),
    ...(c.url_b ? [['Variant B', c.url_b] as [string, string]] : []),
    ...(c.goal ? [['Task given to each persona', c.goal] as [string, string]] : []),
    ...(c.objective ? [['Objective', c.objective] as [string, string]] : []),
    ['Panel', `${new Set(sessions.map((s) => s.persona_id)).size} personas, ${sessions.length} agent sessions`],
  ];
  return {
    title: testName(run), date: fmtTime(run.created_at), runId: run.run_id, single,
    headline: v.headline || verdictLabel(v.winner, single), verdict: verdictLabel(v.winner, single), confidence: v.confidence, rationale: v.rationale,
    details, metrics: run.metrics ?? [], suggestions: v.suggestions ?? [], issues: [...v.issues].sort((a, b) => b.severity - a.severity),
    notes: v.per_persona_notes ?? [], caveats: v.caveats ?? [], sessions, label,
  };
}

const METRIC_ROWS: [string, (m: VariantMetrics) => string][] = [
  ['Sessions', (m) => String(m.sessions)],
  ['Completion rate', (m) => pct(m.completion_rate)],
  ['Mean actions', (m) => num(m.mean_steps)],
  ['Mean duration', (m) => secs(m.mean_duration_s)],
  ['Clicks with no effect', (m) => String(m.dead_clicks)],
  ['Backtracks', (m) => String(m.backtracks)],
  ['Mean ease (1–5)', (m) => num(m.mean_ease)],
  ['Mean trust (1–5)', (m) => num(m.mean_trust)],
  ['Crashed sessions', (m) => String(m.errors)],
];

const METHOD = 'Each persona is an AI agent that used the site in its own real browser, in an isolated cloud container, and was not told it was part of a test. Completion is verified in code against the site (URL, visible text or page element), not taken from the agent. Metrics are computed in code from the recorded sessions; the evaluator interprets them and must cite the session and step behind every issue. Simulated users are an early signal, not a replacement for research with real people.';

// ---------------------------------------------------------------- Markdown
const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

export function buildMarkdown(run: RunState): string {
  const m = model(run);
  const out: string[] = [];
  out.push(`# Usability report: ${m.title}`, '', `*PolyPersona · ${m.date}*`, '');
  out.push('| | |', '|---|---|', ...m.details.map(([k, v]) => `| **${k}** | ${mdCell(v)} |`), '');
  out.push('## Executive summary', '', `**${m.headline}**`, '', `- **Verdict:** ${m.verdict}`, `- **Confidence:** ${cap(m.confidence)}`, '', m.rationale, '');
  if (m.metrics.length) {
    out.push('## Key metrics', '', `| Metric | ${m.metrics.map((x) => m.label(x.variant_id)).join(' | ')} |`, `|---|${m.metrics.map(() => '---:').join('|')}|`);
    for (const [name, f] of METRIC_ROWS) out.push(`| ${name} | ${m.metrics.map(f).join(' | ')} |`);
    out.push('', '*Computed in code from the recorded sessions.*', '');
  }
  if (m.suggestions.length) {
    out.push('## Recommendations', '');
    m.suggestions.forEach((s, i) => {
      out.push(`### ${i + 1}. ${s.title}`, '', `- **Impact:** ${cap(s.impact)} · **Effort:** ${cap(s.effort)}`, `- **Change:** ${s.change}`, `- **Why it helps:** ${s.serves_goal}`);
      if (s.affected_personas.length) out.push(`- **Affected:** ${s.affected_personas.join(', ')}`);
      if (s.evidence.length) out.push(`- **Evidence:** ${s.evidence.map((e) => `\`${e}\``).join(', ')}`);
      out.push('');
    });
  }
  if (m.issues.length) {
    out.push('## Issues found', '', '| Severity | Where | Type | Issue | Affected |', '|:---:|---|---|---|---|');
    for (const i of m.issues) out.push(`| ${i.severity}/5 | ${mdCell(m.single ? 'Site' : m.label(i.variant_id))} | ${cap(i.kind)} | ${mdCell(i.title)} | ${mdCell(i.affected_personas.join(', '))} |`);
    out.push('');
    m.issues.forEach((i, n) => {
      out.push(`**${n + 1}. ${i.title}**  `, `${i.recommendation}  `, `Evidence: ${i.evidence.map((e) => `\`${e}\``).join(', ') || '—'}`, '');
    });
  }
  if (m.notes.length) out.push('## Notes by persona', '', ...m.notes.map((n) => `- ${n}`), '');
  if (m.caveats.length) out.push('## Caveats', '', ...m.caveats.map((n) => `- ${n}`), '');
  out.push('## Appendix: sessions', '', '| Session | Persona | Variant | Outcome | Actions | Duration | Ease | Trust |', '|---|---|---|---|---:|---:|---:|---:|');
  for (const s of m.sessions) {
    out.push(`| \`${s.session_id}\` | ${mdCell(s.persona)} | ${s.variant.toUpperCase()} | ${OUTCOME[s.outcome ?? ''] ?? cap(s.status)} | ${Math.max(0, s.steps.length - 1)} | ${secs(s.duration_s)} | ${s.exit_survey?.ease ?? '—'} | ${s.exit_survey?.trust ?? '—'} |`);
  }
  out.push('');
  for (const s of m.sessions.filter((x) => x.exit_survey || x.observations.length)) {
    out.push(`### ${s.persona} · variant ${s.variant.toUpperCase()}`, '');
    if (s.exit_survey) out.push(`> ${s.exit_survey.summary}`, '');
    for (const o of s.observations) out.push(`- Step ${o.step_idx} · ${o.kind}, severity ${o.severity}: ${o.text}`);
    out.push('');
  }
  out.push('## Methodology', '', METHOD, '', `*Evidence references use the form \`session#step\`. Generated by PolyPersona on ${new Date().toLocaleString()}.*`, '');
  return out.join('\n');
}

// ---------------------------------------------------------------- PDF (print-ready HTML)
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

function evidenceShot(run: RunState, ref: string | undefined): string {
  if (!ref) return '';
  const [sid, idx] = ref.split('#');
  if (!sid || idx == null || !run.sessions[sid]) return '';
  return `<figure><img src="${esc(shotUrl(run.run_id, sid, Number(idx)))}" alt=""><figcaption>${esc(ref)}</figcaption></figure>`;
}

export function buildReportHtml(run: RunState): string {
  const m = model(run);
  const kpi = (k: string, v: string) => `<div class="kpi"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
  const total = m.sessions.length;
  const done = m.sessions.filter((s) => s.outcome === 'completed').length;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(reportFileName(run, 'pdf').replace(/\.pdf$/, ''))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 18mm 16mm 18mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, sans-serif; color: #6b7280; } @bottom-left { content: "PolyPersona · ${esc(m.runId)}"; font: 8pt Inter, sans-serif; color: #6b7280; } }
* { box-sizing: border-box; }
body { font: 10pt/1.5 Inter, system-ui, sans-serif; color: #11142a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 10pt; color: #11142a; }
.brand i { width: 10px; height: 10px; background: #16a34a; border-radius: 2px; display: inline-block; }
.eyebrow { font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; margin-top: 18px; }
h1 { font-size: 21pt; letter-spacing: -0.02em; line-height: 1.2; margin: 4px 0 14px; }
h2 { font-size: 13pt; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1.5px solid #11142a; break-after: avoid; }
h3 { font-size: 10.5pt; margin: 12px 0 4px; break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; font-size: 9pt; break-inside: auto; }
th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid #e3e6ee; vertical-align: top; }
th { font-weight: 600; color: #565d73; background: #f6f7fb; font-size: 8.5pt; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
tr { break-inside: avoid; }
.details td:first-child { width: 30%; color: #565d73; font-weight: 500; }
.summary { border: 1px solid #d3d8e3; border-left: 4px solid #16a34a; border-radius: 4px; padding: 12px 14px; margin: 10px 0; break-inside: avoid; }
.summary .h { font-size: 12.5pt; font-weight: 700; margin-bottom: 4px; }
.pill { display: inline-block; font-size: 8pt; font-weight: 600; padding: 1px 7px; border-radius: 3px; border: 1px solid #d3d8e3; color: #565d73; margin-right: 6px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
.kpi { border: 1px solid #e3e6ee; border-radius: 4px; padding: 8px 10px; }
.kpi .k { font-size: 8pt; color: #6b7280; } .kpi .v { font-size: 15pt; font-weight: 600; margin-top: 2px; }
.rec { border: 1px solid #e3e6ee; border-radius: 4px; padding: 9px 12px; margin: 8px 0; break-inside: avoid; }
.rec h3 { margin: 0 0 4px; }
.rec dl { display: grid; grid-template-columns: 110px 1fr; gap: 2px 10px; margin: 6px 0 0; font-size: 9pt; }
.rec dt { color: #6b7280; } .rec dd { margin: 0; }
.issue { display: grid; grid-template-columns: 1fr 190px; gap: 12px; border: 1px solid #e3e6ee; border-radius: 4px; padding: 9px 12px; margin: 8px 0; break-inside: avoid; }
.issue.noimg { grid-template-columns: 1fr; }
.sev { display: inline-block; min-width: 34px; text-align: center; font-size: 8pt; font-weight: 700; padding: 1px 6px; border-radius: 3px; color: #fff; background: #6b7280; margin-right: 6px; }
.sev.s5, .sev.s4 { background: #dc2626; } .sev.s3 { background: #b45309; }
figure { margin: 0; } figure img { width: 100%; border: 1px solid #e3e6ee; border-radius: 3px; display: block; }
figcaption { font-size: 7.5pt; color: #6b7280; margin-top: 3px; font-family: monospace; }
.muted { color: #565d73; } .small { font-size: 8.5pt; }
ul { margin: 4px 0; padding-left: 18px; } li { margin: 2px 0; }
blockquote { margin: 4px 0 6px; padding-left: 10px; border-left: 2px solid #d3d8e3; color: #565d73; font-style: italic; }
.session { break-inside: avoid; margin: 10px 0; }
.page-break { break-before: page; }
</style></head><body>
<div class="brand"><i></i>PolyPersona</div>
<div class="eyebrow">Usability report${m.single ? '' : ' · A/B comparison'}</div>
<h1>${esc(m.title)}</h1>
<table class="details">${m.details.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>

<h2>Executive summary</h2>
<div class="summary"><div class="h">${esc(m.headline)}</div>
<span class="pill">${esc(m.verdict)}</span><span class="pill">${esc(cap(m.confidence))} confidence</span>
<p style="margin:8px 0 0">${esc(m.rationale)}</p></div>
<div class="kpis">${kpi('Agent sessions', String(total))}${kpi('Reached the goal', `${done} of ${total}`)}${kpi('Issues found', String(m.issues.length))}${kpi('Recommendations', String(m.suggestions.length))}</div>

${m.metrics.length ? `<h2>Key metrics</h2><table><tr><th>Metric</th>${m.metrics.map((x) => `<th class="n">${esc(m.label(x.variant_id))}</th>`).join('')}</tr>
${METRIC_ROWS.map(([name, f]) => `<tr><td>${esc(name)}</td>${m.metrics.map((x) => `<td class="n">${esc(f(x))}</td>`).join('')}</tr>`).join('')}</table>
<p class="small muted">Computed in code from the recorded sessions.</p>` : ''}

${m.suggestions.length ? `<h2>Recommendations</h2>${m.suggestions.map((s, i) => `<div class="rec"><h3>${i + 1}. ${esc(s.title)}</h3>
<dl><dt>Impact / effort</dt><dd>${esc(cap(s.impact))} impact · ${esc(cap(s.effort))} effort</dd><dt>Change</dt><dd>${esc(s.change)}</dd>
<dt>Why it helps</dt><dd>${esc(s.serves_goal)}</dd>${s.affected_personas.length ? `<dt>Affected</dt><dd>${esc(s.affected_personas.join(', '))}</dd>` : ''}
${s.evidence.length ? `<dt>Evidence</dt><dd class="small">${esc(s.evidence.join(', '))}</dd>` : ''}</dl></div>`).join('')}` : ''}

${m.issues.length ? `<h2>Issues found</h2>${m.issues.map((i) => {
    const shot = evidenceShot(run, i.evidence[0]);
    return `<div class="issue${shot ? '' : ' noimg'}"><div><h3><span class="sev s${i.severity}">${i.severity}/5</span>${esc(i.title)}</h3>
<div class="small muted">${esc(m.single ? 'Site' : m.label(i.variant_id))} · ${esc(cap(i.kind))} · affects ${esc(i.affected_personas.join(', ') || '—')}</div>
<p style="margin:6px 0 0"><b>Recommendation:</b> ${esc(i.recommendation)}</p>
<p class="small muted" style="margin:4px 0 0">Evidence: ${esc(i.evidence.join(', ') || '—')}</p></div>${shot}</div>`;
  }).join('')}` : ''}

${m.notes.length ? `<h2>Notes by persona</h2><ul>${m.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
${m.caveats.length ? `<h2>Caveats</h2><ul>${m.caveats.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}

<h2 class="page-break">Appendix: sessions</h2>
<table><tr><th>Session</th><th>Persona</th><th>Variant</th><th>Outcome</th><th class="n">Actions</th><th class="n">Duration</th><th class="n">Ease</th><th class="n">Trust</th></tr>
${m.sessions.map((s) => `<tr><td class="small">${esc(s.session_id)}</td><td>${esc(s.persona)}</td><td>${esc(s.variant.toUpperCase())}</td><td>${esc(OUTCOME[s.outcome ?? ''] ?? cap(s.status))}</td>
<td class="n">${Math.max(0, s.steps.length - 1)}</td><td class="n">${esc(secs(s.duration_s))}</td><td class="n">${s.exit_survey?.ease ?? '—'}</td><td class="n">${s.exit_survey?.trust ?? '—'}</td></tr>`).join('')}</table>
${m.sessions.filter((s) => s.exit_survey || s.observations.length).map((s) => `<div class="session"><h3>${esc(s.persona)} · variant ${esc(s.variant.toUpperCase())}</h3>
${s.exit_survey ? `<blockquote>${esc(s.exit_survey.summary)}</blockquote>` : ''}
${s.observations.length ? `<ul class="small">${s.observations.map((o) => `<li>Step ${o.step_idx} · ${esc(o.kind)}, severity ${o.severity}: ${esc(o.text)}</li>`).join('')}</ul>` : ''}</div>`).join('')}

<h2>Methodology</h2><p class="small">${esc(METHOD)}</p>
<p class="small muted">Evidence references use the form session#step. Generated by PolyPersona on ${esc(new Date().toLocaleString())}.</p>
</body></html>`;
  return html;
}

export function downloadMarkdown(run: RunState) {
  const blob = new Blob([buildMarkdown(run)], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = reportFileName(run, 'md');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Lays the report out in a hidden frame and opens the print dialog, where "Save as PDF" gives a vector PDF. */
export async function downloadPdf(run: RunState): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(buildReportHtml(run)); doc.close();
  // Wait for fonts and evidence screenshots so they are in the PDF.
  await new Promise((r) => (doc.readyState === 'complete' ? r(null) : frame.addEventListener('load', () => r(null), { once: true })));
  await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = () => r(null); }))));
  await (doc.fonts?.ready ?? Promise.resolve());
  const prevTitle = document.title;
  document.title = reportFileName(run, 'pdf').replace(/\.pdf$/, ''); // Safari uses the parent title as the file name
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => { document.title = prevTitle; frame.remove(); }, 1500);
}
