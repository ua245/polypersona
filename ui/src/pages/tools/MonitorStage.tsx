// Stage 3: every agent at once. Cards are grouped by persona, variants side by side.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { fmtTokens, sessionList, type RunState, type SessionState } from '../../lib/api';
import { C, KindTag, PatienceBar, RunStatusTag, Screenshot, SessionTag, Tag, stepLabel } from '../../lib/ui';

const CSS = `
.pp-agent { display: flex; flex-direction: column; color: inherit; text-decoration: none; padding: 14px; min-width: 0; transition: border-color 0.15s, background 0.15s; }
.pp-agent:hover { border-color: #2f3648; background: #14171d; }
.pp-agent[data-live="true"] { border-color: rgba(250,204,21,0.28); }
.pp-clamp { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
`;

const variantName = (v: string) => `Variant ${v.toUpperCase()}`;
const winnerName = (w: string) => (w.length <= 2 ? variantName(w) : w.charAt(0).toUpperCase() + w.slice(1));

export default function MonitorStage({ run, pollError }: { run: RunState; pollError: string | null }) {
  const sessions = sessionList(run);
  const running = sessions.filter((s) => s.status === 'running').length;
  const finished = sessions.filter((s) => s.status === 'finished').length;
  const completed = sessions.filter((s) => s.outcome === 'completed').length;
  const sessionTokens = sessions.reduce((n, s) => n + (s.tokens ?? 0), 0);
  const tokens = run.tokens?.total ?? (sessionTokens > 0 ? sessionTokens : null);
  const insights = `/insights?run=${run.run_id}`;
  const done = run.status === 'finished';

  const groups = new Map<string, SessionState[]>();
  for (const s of sessions) groups.set(s.persona_id, [...(groups.get(s.persona_id) ?? []), s]);

  return (
    <div>
      <style>{CSS}</style>

      {run.status === 'failed' && (
        <Banner tone={C.red} title="This run failed">{run.error ?? 'The orchestrator did not report a reason.'}</Banner>
      )}
      {run.status === 'evaluating' && (
        <Banner tone={C.yellow} title="All sessions finished. The evaluator is judging the run…" pulse>
          It reads every journey, observation and exit survey, then picks a winner. This usually takes under a minute.
        </Banner>
      )}
      {done && run.verdict && (
        <Banner tone={C.green} title={run.verdict.winner === 'no clear winner' ? 'No clear winner' : `${winnerName(run.verdict.winner)} wins`}
          aside={<Tag tone={run.verdict.confidence === 'high' ? 'green' : run.verdict.confidence === 'medium' ? 'yellow' : 'muted'}>{run.verdict.confidence} confidence</Tag>}>
          <span className="pp-clamp" style={{ WebkitLineClamp: 4 }}>{run.verdict.rationale}</span>
          <Link to={insights} style={{ color: C.green, fontSize: 13, fontWeight: 500, display: 'inline-block', marginTop: 8 }}>Open insights</Link>
        </Banner>
      )}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px', padding: '10px 14px', marginBottom: 20 }}>
        <span className="mono" style={{ fontSize: 12, color: C.text, overflowWrap: 'anywhere' }}>{run.run_id}</span>
        <RunStatusTag status={run.status} />
        <Count n={running} label="running" />
        <Count n={finished} of={sessions.length} label="finished" />
        <Count n={completed} label="completed the goal" />
        {tokens != null && <span className="mono" style={{ fontSize: 12, color: C.muted2 }}><span style={{ color: C.text }}>{fmtTokens(tokens)}</span> tokens</span>}
        <span style={{ flex: 1 }} />
        {done
          ? <Link to={insights} className="btn-secondary" style={{ textDecoration: 'none', fontSize: 12, padding: '5px 12px' }}>Open insights</Link>
          : <span aria-disabled="true" title="Available when the run has finished" className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px', opacity: 0.5, cursor: 'not-allowed' }}>Open insights</span>}
      </div>

      {pollError && <div role="alert" style={{ color: C.yellow, fontSize: 12, marginBottom: 12 }}>Connection problem, retrying: {pollError}</div>}

      {sessions.length === 0 && run.status !== 'failed' && (
        <div className="card" style={{ padding: 20, color: C.muted2, fontSize: 13 }}>No sessions yet. Containers are still starting.</div>
      )}

      {[...groups.entries()].map(([pid, list]) => {
        const p = list[0];
        return (
          <section key={pid} aria-label={p.persona} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.persona}</h2>
              <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>{p.device} · {p.savviness} savviness · {p.patience} actions of patience</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
              {list.map((s) => <AgentCard key={s.session_id} runId={run.run_id} s={s} showRepeat={(run.config.repeats ?? 1) > 1} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Count({ n, of, label }: { n: number; of?: number; label: string }) {
  return <span className="mono" style={{ fontSize: 12, color: C.muted2 }}><span style={{ color: C.text }}>{n}</span>{of != null ? `/${of}` : ''} {label}</span>;
}

function Banner({ tone, title, aside, pulse, children }: { tone: string; title: string; aside?: ReactNode; pulse?: boolean; children: ReactNode }) {
  return (
    <div role="status" className="card" style={{ padding: '14px 16px', marginBottom: 16, borderColor: `${tone}55`, borderLeft: `3px solid ${tone}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        {pulse && <span className="dot-yellow" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        {aside}
      </div>
      <div style={{ color: C.muted2, fontSize: 13, lineHeight: 1.55, marginTop: 6, maxWidth: 980 }}>{children}</div>
    </div>
  );
}

function AgentCard({ runId, s, showRepeat }: { runId: string; s: SessionState; showRepeat: boolean }) {
  const steps = s.steps ?? [];
  const last = steps.length ? steps[steps.length - 1] : null;
  const observations = s.observations ?? [];
  const obs = observations.length ? observations[observations.length - 1] : null;
  const used = Math.max(0, s.patience - s.actions_left);
  const live = s.status === 'running';

  return (
    <Link
      to={`/populations/${s.session_id}?run=${runId}`}
      className="card pp-agent"
      data-live={live}
      aria-label={`${s.persona}, ${variantName(s.variant)}${showRepeat ? `, repeat ${s.repeat + 1}` : ''}: open agent detail`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {live && <span className="dot-yellow" aria-hidden="true" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{variantName(s.variant)}</span>
        {showRepeat && <span className="mono" style={{ fontSize: 11, color: C.muted }}>repeat {s.repeat + 1}</span>}
        <span style={{ flex: 1 }} />
        <SessionTag s={s} />
      </div>

      {last ? (
        <Screenshot runId={runId} sessionId={s.session_id} idx={last.idx} device={s.device} maxHeight={260} style={{ height: 260, alignItems: 'center' }} />
      ) : (
        <div style={{ height: 260, border: `1px dashed ${C.border2}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>
          {s.status === 'queued' ? 'Waiting for a container' : 'Opening the site…'}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <PatienceBar left={s.actions_left} total={Math.max(1, s.patience)} />
        <div className="mono" style={{ fontSize: 11, color: C.muted2, marginTop: 6 }}>
          {used} {used === 1 ? 'action' : 'actions'} · {s.actions_left} of {s.patience} patience left
        </div>
      </div>

      {last && (
        <div style={{ marginTop: 10 }}>
          <div className="mono" style={{ fontSize: 12, color: C.text, overflowWrap: 'anywhere' }}>
            {stepLabel(last)}
            {!last.changed && <span className="tag-green tag-red" style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px' }}>no change</span>}
          </div>
          {last.reasoning && (
            <div className="pp-clamp" style={{ WebkitLineClamp: 2, fontSize: 12.5, color: C.muted2, fontStyle: 'italic', marginTop: 4, lineHeight: 1.45 }}>“{last.reasoning}”</div>
          )}
        </div>
      )}

      {obs && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <KindTag kind={obs.kind} severity={obs.severity} />
            <span className="mono" style={{ fontSize: 11, color: C.muted }}>step {obs.step_idx} · {observations.length} noted</span>
          </div>
          <div className="pp-clamp" style={{ WebkitLineClamp: 3, fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>{obs.text}</div>
        </div>
      )}

      {s.exit_survey && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <blockquote className="pp-clamp" style={{ WebkitLineClamp: 4, margin: 0, paddingLeft: 10, borderLeft: `2px solid ${C.border2}`, fontSize: 12.5, color: C.muted2, lineHeight: 1.5 }}>
            {s.exit_survey.summary}
          </blockquote>
          <div className="mono" style={{ fontSize: 11, color: C.muted2, marginTop: 8 }}>
            ease <span style={{ color: C.text }}>{s.exit_survey.ease}/5</span> · trust <span style={{ color: C.text }}>{s.exit_survey.trust}/5</span> · {s.exit_survey.would_return ? 'would return' : 'would not return'}
          </div>
        </div>
      )}

      {s.error && <div style={{ marginTop: 10, fontSize: 12, color: C.red, overflowWrap: 'anywhere' }}>{s.error}</div>}
    </Link>
  );
}
