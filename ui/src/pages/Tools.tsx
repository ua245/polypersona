// /tools — Test setup → Orchestration → Journey monitor.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { fmtTokens, sessionList, useRun, type RunState } from '../lib/api';
import { C, Empty, Page, RunStatusTag } from '../lib/ui';
import SetupStage from './tools/SetupStage';
import OrchestrationStage from './tools/OrchestrationStage';
import MonitorStage from './tools/MonitorStage';

type Stage = 1 | 2 | 3;
const STAGES: { n: Stage; label: string; hint: string }[] = [
  { n: 1, label: 'Test setup', hint: 'Personas, target, repeats' },
  { n: 2, label: 'Orchestration', hint: 'One container per session' },
  { n: 3, label: 'Journey monitor', hint: 'Every agent, live' },
];

/** Stage the run is naturally in: fan-out until any session has started, then the monitor. */
function autoStage(runId: string | null, run: RunState | null): Stage {
  if (!runId) return 1;
  if (!run) return 3;
  if (run.status === 'failed') return 3;
  const sessions = sessionList(run);
  const started = sessions.some((s) => s.status !== 'queued');
  return started ? 3 : 2;
}

export default function Tools() {
  const [params] = useSearchParams();
  const runId = params.get('run');
  const { run, error } = useRun(runId);
  const natural = autoStage(runId, run);
  const [manual, setManual] = useState<Stage | null>(null);

  // A new run, or the run moving from fan-out to running, takes the view with it.
  useEffect(() => { setManual(null); }, [runId, natural]);

  const stage: Stage = manual ?? natural;
  const reachable = (n: Stage) => n === 1 || runId != null;

  return (
    <Page
      title="Run a test"
      subtitle="Set up a comparison, watch it fan out to containers, then follow every agent as it works through the site."
      actions={runId && run && stage !== 3 ? (
        <>
          <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>{run.run_id}</span>
          <RunStatusTag status={run.status} />
          {run.tokens?.total != null && <span className="mono" style={{ fontSize: 12, color: C.muted }}>{fmtTokens(run.tokens.total)} tokens</span>}
        </>
      ) : undefined}
    >
      <nav aria-label="Stages" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 24 }}>
        {STAGES.map((s) => {
          const active = s.n === stage;
          const can = reachable(s.n);
          return (
            <button
              key={s.n}
              type="button"
              disabled={!can}
              aria-current={active ? 'step' : undefined}
              onClick={() => setManual(s.n)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: can ? 'pointer' : 'not-allowed', minWidth: 0,
                background: active ? C.surface2 : C.surface, color: C.text, fontFamily: 'inherit',
                border: `1px solid ${active ? C.green : C.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span className="mono" style={{
                  flex: 'none', width: 20, height: 20, borderRadius: '50%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? C.green : 'transparent', color: active ? C.bg : C.muted2, border: `1px solid ${active ? C.green : C.border2}`,
                }}>{s.n}</span>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, minWidth: 0, overflowWrap: 'anywhere' }}>{s.label}</span>
              </div>
              <div className="hidden sm:block" style={{ fontSize: 12, color: C.muted, marginTop: 4, paddingLeft: 28 }}>{s.hint}</div>
            </button>
          );
        })}
      </nav>

      {stage === 1 && <SetupStage showRecent={!runId} />}

      {stage !== 1 && runId && !run && (
        error
          ? <Empty title="This run could not be loaded"><span role="alert">{error}</span> · <Link to="/tools" style={{ color: C.green }}>Set up a new test</Link></Empty>
          : <Empty title="Loading run…"><span className="mono">{runId}</span></Empty>
      )}
      {stage === 2 && run && <OrchestrationStage run={run} />}
      {stage === 3 && run && <MonitorStage run={run} pollError={error} />}
    </Page>
  );
}
