// The middle of the story: what came up most, the one thing to take away, and what is on fire.
import type { Issue, RunState } from '../../../lib/api';
import { C } from '../../../lib/ui';
import { Bar, Panel, issueKey, kindColor, sentences, winnerOf } from './shared';

export function LeadingThemes({ issues, onSelect }: { issues: Issue[]; onSelect: (index: number) => void }) {
  const weight = (i: Issue) => Math.max(1, i.affected_personas.length) * Math.max(1, i.severity);
  const top = Math.max(1, ...issues.map(weight));
  const rows = issues.map((issue, index) => ({ issue, index })).sort((a, b) => weight(b.issue) - weight(a.issue));
  return (
    <Panel title="Leading themes" hint="bar = personas affected × severity">
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: C.muted2 }}>The evaluator did not raise any issues for this test.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {rows.map(({ issue, index }) => {
            const n = issue.affected_personas.length;
            return (
              <li key={issueKey(issue, index)}>
                <button type="button" className="pp-theme-row" onClick={() => onSelect(index)} title="Jump to this issue and its evidence">
                  <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: kindColor(issue.kind), flexShrink: 0 }} />
                  <span style={{ flex: '1 1 0', minWidth: 0 }}>
                    <span className="pp-clamp-2" style={{ fontSize: 13, lineHeight: 1.35, color: C.text }}>{issue.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: C.muted }}>{issue.kind} · variant {issue.variant_id.toUpperCase()} · severity {issue.severity}</span>
                  </span>
                  <span style={{ flex: '0 0 clamp(44px, 22%, 130px)' }}><Bar value={weight(issue) / top} color={kindColor(issue.kind)} /></span>
                  <span className="mono" style={{ fontSize: 11, color: C.muted2, width: 22, textAlign: 'right', flexShrink: 0 }} aria-label={`${n} ${n === 1 ? 'persona' : 'personas'} affected`}>{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 12, fontSize: 11, color: C.muted }}>
        {([['bug', C.red], ['friction or confusion', C.yellow], ['delight', C.green]] as const).map(([label, color]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{label}</span>
        ))}
        <span style={{ marginLeft: 'auto' }}>number = personas affected</span>
      </div>
    </Panel>
  );
}

/** The most severe problem; ties go to the one that hit more personas. Delights are never "first to fix". */
export function worstIssue(issues: Issue[]): { issue: Issue; index: number } | null {
  let best: { issue: Issue; index: number } | null = null;
  for (let index = 0; index < issues.length; index++) {
    const issue = issues[index]!;
    if (issue.kind === 'delight' || issue.kind === 'opinion') continue;
    if (!best || issue.severity > best.issue.severity || (issue.severity === best.issue.severity && issue.affected_personas.length > best.issue.affected_personas.length)) best = { issue, index };
  }
  return best;
}

export function KeyFinding({ run, onSelect }: { run: RunState; onSelect: (index: number) => void }) {
  const verdict = run.verdict;
  if (!verdict) return null;
  const all = sentences(verdict.rationale ?? '');
  const lead = all.slice(0, all.slice(0, 3).join(' ').length <= 340 ? 3 : 2).join(' ');
  const first = worstIssue(verdict.issues);
  const agents = Object.keys(run.sessions).length;
  return (
    <section aria-label="Key finding" style={{ padding: 20, borderRadius: 8, border: '1px solid rgba(74,222,128,0.28)', background: 'rgba(74,222,128,0.05)', minWidth: 0 }}>
      <div className="mono" style={{ color: C.green, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{agents} {agents === 1 ? 'agent' : 'agents'} · key finding</div>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.65, color: C.text }}>{lead || (winnerOf(run) ? 'The evaluator named a winner without a written rationale.' : 'The evaluator did not write a rationale.')}</p>
      {first && first.issue.recommendation && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(74,222,128,0.18)' }}>
          <div className="mono" style={{ color: C.green, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Do this first</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: C.text }}>{first.issue.recommendation}</p>
          <button type="button" onClick={() => onSelect(first.index)} style={{ marginTop: 8, padding: 0, background: 'none', border: 'none', color: C.muted2, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            Fixes “{first.issue.title}” on variant {first.issue.variant_id.toUpperCase()}, severity {first.issue.severity} of 5. <span style={{ color: C.green }}>See the evidence</span>
          </button>
        </div>
      )}
    </section>
  );
}

export function NotableAlerts({ issues, onSelect }: { issues: Issue[]; onSelect: (index: number) => void }) {
  const alerts = issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => issue.severity >= 4 && issue.kind !== 'delight').sort((a, b) => b.issue.severity - a.issue.severity);
  return (
    <Panel title="Notable alerts" hint="severity 4 and 5">
      {alerts.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: C.muted2 }}>Nothing reached severity 4. No variant has a blocker in this test.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {alerts.map(({ issue, index }) => {
            const red = issue.kind === 'bug';
            const rgb = red ? '248,113,113' : '250,204,21';
            const n = issue.affected_personas.length;
            return (
              <li key={issueKey(issue, index)}>
                <button type="button" onClick={() => onSelect(index)} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 12px', borderRadius: 6, background: `rgba(${rgb},0.07)`, border: `1px solid rgba(${rgb},0.28)` }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: red ? C.red : C.yellow }}>{issue.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: C.muted2, marginTop: 2 }}>
                    Variant {issue.variant_id.toUpperCase()} · {issue.kind}, severity {issue.severity} of 5{n > 0 && ` · ${n === 1 ? issue.affected_personas[0] : `${n} personas`}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
