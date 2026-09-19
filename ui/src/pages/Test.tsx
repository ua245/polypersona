// One test, one page. Live shows the agents working; Results shows what they found.
import { Link, useParams, useSearchParams } from 'react-router';
import { fmtTime, fmtTokens, useRun } from '../lib/api';
import { isSingleSite, runCounts, testName, verdictLabel } from '../lib/derive';
import { C, Empty, RunStatusTag } from '../lib/ui';
import LiveTab from './test/LiveTab';
import ResultsTab from './test/ResultsTab';

export default function Test() {
  const { runId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { run, error } = useRun(runId);
  const tab: 'live' | 'results' = params.get('tab') === 'results' ? 'results' : 'live';
  const setTab = (t: 'live' | 'results') => setParams(t === 'results' ? { tab: 'results' } : {}, { replace: true });

  if (!run) {
    return (
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 24px' }}>
        {error ? <Empty title="This test could not be loaded"><span role="alert">{error}</span> · <Link to="/workspace" style={{ color: C.green }}>Back to your tests</Link></Empty>
          : <Empty title="Loading test…" />}
      </div>
    );
  }

  const counts = runCounts(run);
  const ready = run.status === 'finished' && run.verdict != null;
  const starting = run.status === 'starting' || (counts.total > 0 && counts.starting === counts.total);
  const tabs = [
    { key: 'live' as const, label: 'Live', hint: run.status === 'finished' ? 'replay every agent' : starting ? 'agents are starting' : `${counts.finished} of ${counts.total} agents finished` },
    { key: 'results' as const, label: 'Results', hint: ready ? verdictLabel(run.verdict!.winner, isSingleSite(run)) : run.status === 'evaluating' ? 'the evaluator is judging…' : run.status === 'failed' ? 'not available' : 'ready when every agent finishes' },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 24px 64px' }}>
      <Link to="/workspace" className="btn-ghost" style={{ textDecoration: 'none', paddingLeft: 0, fontSize: 12 }}>← Your tests</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', margin: '6px 0 18px' }}>
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {run.status === 'finished' ? 'Finished test' : run.status === 'failed' ? 'Failed test' : 'Live test'} · {fmtTime(run.created_at)}
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{testName(run)}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 6, color: C.muted2, fontSize: 13 }}>
            <RunStatusTag status={run.status} />
            <span>{counts.total} agents, each in its own container</span>
            {run.tokens?.total != null && <span className="mono" style={{ fontSize: 12 }}>{fmtTokens(run.tokens.total)} tokens</span>}
          </div>
        </div>
        <Link to="/new" className="btn-secondary" style={{ textDecoration: 'none' }}>New test</Link>
      </div>

      <div role="tablist" aria-label="Test views" style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {tabs.map((t) => {
          const on = t.key === tab;
          const nudge = t.key === 'results' && ready && !on; // the verdict is in: point at it
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)} style={{
              background: 'transparent', border: 'none', borderBottom: `2px solid ${on ? C.green : 'transparent'}`, color: on ? C.text : C.muted2,
              padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: -1,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                {t.label}{nudge && <span className="dot-green" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: nudge ? C.green : C.muted, marginTop: 2 }}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      {run.status === 'failed' && <div role="alert" className="card" style={{ padding: 16, borderColor: 'rgba(var(--pp-red-rgb),0.4)', marginBottom: 16, fontSize: 13 }}><b style={{ color: C.red }}>This test failed.</b> {run.error ?? 'No details were recorded.'}</div>}
      {tab === 'live' ? <LiveTab run={run} onOpenResults={() => setTab('results')} /> : <ResultsTab run={run} onOpenLive={() => setTab('live')} />}
    </div>
  );
}
