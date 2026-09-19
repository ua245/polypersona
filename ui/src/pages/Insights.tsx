// /insights — the results of one run: verdict, metrics computed in code, issues with evidence, sessions, follow-up questions.
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { fmtTime, fmtTokens, sessionList, useRun, useRuns, useSelectedRunId, type RunConfig, type RunState, type Verdict } from '../lib/api';
import { C, Empty, Page, RunStatusTag, SectionLabel, SessionTag, Tag } from '../lib/ui';
import Metrics from './insights/Metrics';
import Issues from './insights/Issues';
import Ask from './insights/Ask';

const isNoWinner = (winner: string) => winner.trim().toLowerCase() === 'no clear winner';

/** What a variant id points at: a demo shop variant, or one of the two URLs under test. */
function variantTarget(config: RunConfig | undefined, id: string): string {
  if (config?.url_a && id === 'a') return config.url_a;
  if (config?.url_b && id === 'b') return config.url_b;
  return `demo shop, variant ${id.toUpperCase()}`;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return <section style={{ marginTop: 32 }}><SectionLabel>{label}</SectionLabel>{children}</section>;
}

function VerdictBlock({ run, verdict }: { run: RunState; verdict: Verdict }) {
  const none = isNoWinner(verdict.winner);
  const tone = verdict.confidence === 'high' ? 'green' : verdict.confidence === 'medium' ? 'yellow' : 'muted';
  return (
    <div className="card" style={{ padding: 24, borderColor: none ? C.border2 : 'rgba(74,222,128,0.25)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'baseline' }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{none ? 'Outcome' : 'Winner'}</div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, color: none ? C.text : C.green }}>
            {none ? 'No clear winner' : `Variant ${verdict.winner.toUpperCase()}`}
          </div>
        </div>
        <Tag tone={tone}>{verdict.confidence} confidence</Tag>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4, overflowWrap: 'anywhere' }}>
        {none
          ? 'The evaluator judged that the evidence does not separate the variants. That is a result, not a failure: see the caveats and metrics below.'
          : variantTarget(run.config, verdict.winner)}
      </div>
      <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.65, color: C.text, maxWidth: 900 }}>{verdict.rationale}</p>
      {verdict.caveats.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.yellow, marginBottom: 6 }}>Caveats</div>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 13, lineHeight: 1.6, color: C.muted2, maxWidth: 900 }}>
            {verdict.caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function SessionsTable({ run }: { run: RunState }) {
  const sessions = sessionList(run);
  const th = { padding: '10px 14px', fontSize: 11, fontWeight: 500, color: C.muted2, textAlign: 'left' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const };
  const td = { padding: '10px 14px', fontSize: 13, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const };
  const num = { ...td, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textAlign: 'right' as const };
  if (sessions.length === 0) return <Empty title="No sessions yet" />;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr>
            <th scope="col" style={th}>Persona</th>
            <th scope="col" style={th}>Variant</th>
            <th scope="col" style={th}>Outcome</th>
            <th scope="col" style={{ ...th, textAlign: 'right' }}>Actions</th>
            <th scope="col" style={{ ...th, textAlign: 'right' }}>Duration</th>
            <th scope="col" style={{ ...th, textAlign: 'right' }}>Ease</th>
            <th scope="col" style={{ ...th, textAlign: 'right' }}>Trust</th>
            <th scope="col" style={{ ...th, textAlign: 'right' }}>Tokens</th>
            <th scope="col" style={th}><span style={{ position: 'absolute', left: -9999 }}>Detail</span></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const actions = Math.max(0, s.steps.length - 1); // step 0 is the page load
            return (
              <tr key={s.session_id}>
                <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 500 }}>
                  {s.persona}
                  <span style={{ color: C.muted, fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{s.device}{s.repeat > 0 ? `, repeat ${s.repeat + 1}` : ''}</span>
                </th>
                <td style={td}><span className="mono" style={{ textTransform: 'uppercase' }}>{s.variant}</span></td>
                <td style={td}><SessionTag s={s} /></td>
                <td style={num}>{actions}<span style={{ color: C.muted }}> / {s.patience}</span></td>
                <td style={num}>{s.duration_s != null ? `${s.duration_s.toFixed(1)} s` : '–'}</td>
                <td style={num}>{s.exit_survey ? `${s.exit_survey.ease} / 5` : '–'}</td>
                <td style={num}>{s.exit_survey ? `${s.exit_survey.trust} / 5` : '–'}</td>
                <td style={num}>{fmtTokens(s.tokens)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <Link to={`/populations/${encodeURIComponent(s.session_id)}?run=${encodeURIComponent(run.run_id)}`} style={{ color: C.green, textDecoration: 'none', fontSize: 12 }} aria-label={`Open ${s.persona} on variant ${s.variant.toUpperCase()}`}>
                    Open agent
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Insights() {
  const [params, setParams] = useSearchParams();
  const runId = useSelectedRunId();
  const { runs, error: runsError } = useRuns();
  const { run, error, live } = useRun(runId);

  const options = runs ?? [];
  const inList = runId != null && options.some((r) => r.run_id === runId);
  const picker = (
    <>
      <label htmlFor="pp-run-picker" style={{ fontSize: 12, color: C.muted2 }}>Run</label>
      <select
        id="pp-run-picker"
        className="input mono"
        value={runId ?? ''}
        disabled={options.length === 0 && !runId}
        onChange={(e) => { const next = new URLSearchParams(params); next.set('run', e.target.value); setParams(next); }}
        style={{ width: 'auto', maxWidth: 'min(340px, 70vw)', fontSize: 12, padding: '6px 10px' }}
      >
        {!runId && <option value="">No runs</option>}
        {runId && !inList && <option value={runId}>{runId}</option>}
        {options.map((r) => (
          <option key={r.run_id} value={r.run_id}>
            {[fmtTime(r.created_at) || r.run_id, r.status, r.winner ? (isNoWinner(r.winner) ? 'no clear winner' : `winner ${r.winner.toUpperCase()}`) : null].filter(Boolean).join(' · ')}
          </option>
        ))}
      </select>
    </>
  );

  let body: ReactNode;
  if (!runId) {
    body = runs == null && !runsError
      ? <Empty title="Loading runs…" />
      : runsError && runs == null
        ? <Empty title="Could not load runs">{runsError}</Empty>
        : <Empty title="No runs yet">Results appear here once a test has run. <Link to="/tools" style={{ color: C.green }}>Start a test</Link></Empty>;
  } else if (!run) {
    body = error ? <Empty title="Could not load this run">{error}</Empty> : <Empty title="Loading run…" />;
  } else {
    const sessions = sessionList(run);
    const done = sessions.filter((s) => s.status === 'finished').length;
    body = (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', fontSize: 12, color: C.muted2, marginBottom: 16 }}>
          <span className="mono">{run.run_id}</span>
          <RunStatusTag status={run.status} />
          <span>{fmtTime(run.created_at)}</span>
          <span>{sessions.length} sessions</span>
          {run.config.goal && <span style={{ overflowWrap: 'anywhere' }}>Goal: {run.config.goal}</span>}
          {run.tokens?.total != null && <span className="mono">{fmtTokens(run.tokens.total)} tokens</span>}
          <Link to={`/populations?run=${encodeURIComponent(run.run_id)}`} style={{ color: C.green, textDecoration: 'none' }}>Agents</Link>
          <Link to={`/tools?run=${encodeURIComponent(run.run_id)}`} style={{ color: C.green, textDecoration: 'none' }}>Monitor</Link>
        </div>

        {live && (
          <div className="card" role="status" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', borderColor: 'rgba(250,204,21,0.25)' }}>
            <div style={{ fontSize: 13 }}>
              <span className="dot-yellow" style={{ marginRight: 8, animation: 'pp-pulse 1.4s ease-in-out infinite' }} />
              {run.status === 'evaluating'
                ? 'All sessions are in. The evaluator is reading them and will name a winner shortly.'
                : `This run is still going: ${done} of ${sessions.length} sessions finished. The verdict appears here when it ends.`}
            </div>
            <Link to={`/tools?run=${encodeURIComponent(run.run_id)}`} className="btn-secondary" style={{ textDecoration: 'none' }}>Watch it live</Link>
          </div>
        )}
        {run.status === 'failed' && (
          <div className="card" role="alert" style={{ padding: 16, borderColor: 'rgba(248,113,113,0.3)', fontSize: 13 }}>
            <span style={{ color: C.red, fontWeight: 600 }}>This run failed.</span>{' '}
            <span style={{ color: C.muted2, overflowWrap: 'anywhere' }}>{run.error ?? 'No error message was recorded.'}</span>
          </div>
        )}

        {run.verdict && <VerdictBlock run={run} verdict={run.verdict} />}

        {run.metrics && run.metrics.length > 0 && (
          <Section label="Metrics · computed in code">
            <Metrics metrics={run.metrics} winner={run.verdict?.winner} />
          </Section>
        )}

        {run.verdict && (
          <>
            <Section label={`Issues · ${run.verdict.issues.length}`}>
              <Issues run={run} issues={run.verdict.issues} />
            </Section>
            {run.verdict.per_persona_notes.length > 0 && (
              <Section label="Per-persona notes">
                <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
                  {run.verdict.per_persona_notes.map((note, i) => {
                    const at = note.indexOf(':');
                    const named = at > 0 && at < 40;
                    return (
                      <li key={i} className="card" style={{ listStyle: 'none', padding: 16, fontSize: 13, lineHeight: 1.6, color: C.muted2 }}>
                        {named && <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>{note.slice(0, at)}</div>}
                        {named ? note.slice(at + 1).trim() : note}
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </>
        )}

        <Section label="Sessions"><SessionsTable run={run} /></Section>

        <Section label="Ask the evaluator"><Ask runId={run.run_id} finished={run.status === 'finished'} /></Section>
      </>
    );
  }

  return (
    <Page title="Insights" subtitle="What the agents found, which variant held up, and the steps that prove it." actions={picker}>
      {body}
    </Page>
  );
}
