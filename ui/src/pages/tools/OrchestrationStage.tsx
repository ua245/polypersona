// Stage 2: the fan-out. One row per session, because each session gets its own container.
import { sessionList, type RunState, type SessionState } from '../../lib/api';
import { C, SectionLabel, SessionTag } from '../../lib/ui';

const ORDER: SessionState['status'][] = ['queued', 'running', 'finished'];

export default function OrchestrationStage({ run }: { run: RunState }) {
  const sessions = sessionList(run);
  const count = (st: SessionState['status']) => sessions.filter((s) => s.status === st).length;

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {run.status === 'starting' ? 'Starting containers' : run.status === 'failed' ? 'Run failed' : 'Fan-out'}
        </div>
        <p style={{ color: C.muted2, fontSize: 13, margin: '6px 0 0', maxWidth: 720 }}>
          Every session below runs in its own Modal container with its own Chromium browser, so agents never share state.
          Containers start in parallel; a cold start usually takes a few seconds. This view moves to the journey monitor as soon as the first agent is running.
        </p>
        {run.error && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{run.error}</div>}
        <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: C.muted2, marginTop: 12 }}>
          {ORDER.map((st) => <span key={st}><span style={{ color: C.text }}>{count(st)}</span> {st}</span>)}
          <span><span style={{ color: C.text }}>{sessions.length}</span> total</span>
        </div>
      </div>

      <SectionLabel>Sessions</SectionLabel>
      {sessions.length === 0 ? (
        <div className="card" style={{ padding: 20, color: C.muted2, fontSize: 13 }}>
          <span className="dot-yellow" style={{ marginRight: 8, animation: 'pp-pulse 1.4s ease-in-out infinite' }} />
          The orchestrator has accepted the run and is creating its sessions.
        </div>
      ) : (
        <ul className="card" style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'hidden' }}>
          {sessions.map((s, i) => (
            <li key={s.session_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', padding: '10px 14px', borderTop: i ? `1px solid ${C.border}` : undefined }}>
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 0 }}>{s.persona}</span>
              <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>variant {s.variant.toUpperCase()} · repeat {s.repeat + 1} · {s.device}</span>
              <span style={{ flex: 1 }} />
              <StateTrack status={s.status} />
              <SessionTag s={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** queued → running → finished, as three pips. */
function StateTrack({ status }: { status: SessionState['status'] }) {
  const at = ORDER.indexOf(status);
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {ORDER.map((st, i) => (
        <span key={st} style={{
          width: 18, height: 3, borderRadius: 2,
          background: i <= at ? (status === 'finished' ? C.green : C.yellow) : C.border2,
          animation: i === at && status === 'running' ? 'pp-pulse 1.4s ease-in-out infinite' : undefined,
        }} />
      ))}
    </span>
  );
}
