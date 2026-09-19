// Your tests: one row per test, live ones first, and four totals computed from the list.
import { Link } from 'react-router';
import { fmtTime, useRuns, type RunStatus, type RunSummary } from '../lib/api';
import { SENTIMENT_HELP, pct, sentimentTone, testName, testPath } from '../lib/derive';
import { C, Tag } from '../lib/ui';
import { Eyebrow } from './newtest/bits';

const isLive = (s: RunStatus) => s === 'starting' || s === 'running' || s === 'evaluating';
const TONE_COLOR = { green: C.green, yellow: C.yellow, red: C.red, muted: C.muted } as const;

const agentsOf = (r: RunSummary): number | null => r.sessions ?? null;
function winnerLabel(r: RunSummary): string {
  if (!r.winner) return '–';
  if (r.winner === 'single site') return 'Assessed';
  return r.winner.length <= 2 ? `${r.winner.toUpperCase()} wins` : 'No clear winner';
}
const hasClearWinner = (r: RunSummary) => !!r.winner && r.winner.length <= 2;

function subLine(r: RunSummary): string {
  const who = r.personas?.length ? r.personas.join(', ') : agentsOf(r) != null ? `${agentsOf(r)} agents` : '';
  return [who, fmtTime(r.created_at)].filter(Boolean).join(' · ');
}

export default function Workspace() {
  const { runs, error } = useRuns();
  const sorted = runs ? [...runs].sort((a, b) => Number(isLive(b.status)) - Number(isLive(a.status)) || (b.created_at ?? 0) - (a.created_at ?? 0)) : null;
  const liveCount = sorted?.filter((r) => isLive(r.status)).length ?? 0;

  return (
    <div className="ws-wrap">
      <style>{CSS}</style>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 36 }}>
        <div>
          <Eyebrow>Workspace</Eyebrow>
          <h1 style={{ margin: '12px 0 0', fontSize: 'clamp(28px, 4vw, 34px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Your tests</h1>
        </div>
        <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 14 }}>New test</Link>
      </header>

      {error && !sorted && <div role="alert" className="card" style={{ padding: 20, color: C.red, fontSize: 13 }}>Your tests could not be loaded: {error}</div>}
      {!sorted && !error && <div aria-busy="true" style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="card" style={{ height: 84, opacity: 0.5 }} />)}</div>}

      {sorted && sorted.length === 0 && (
        <div className="card" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>No tests yet</div>
          <p style={{ color: C.muted2, fontSize: 14, margin: '8px auto 24px', maxWidth: 420, lineHeight: 1.6 }}>
            Pick two variants and a few personas. In about three minutes you will have a verdict with screenshots to back it up.
          </p>
          <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 14 }}>Start your first test</Link>
        </div>
      )}

      {sorted && sorted.length > 0 && (
        <>
          {liveCount > 0 && (
            <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.green, marginBottom: 10 }}>
              <span className="dot-green" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />
              {liveCount === 1 ? 'Running now' : `${liveCount} running now`}
            </div>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {sorted.map((r) => <li key={r.run_id}><TestRow r={r} /></li>)}
          </ul>
          <Totals runs={sorted} liveCount={liveCount} />
        </>
      )}
    </div>
  );
}

function TestRow({ r }: { r: RunSummary }) {
  const live = isLive(r.status);
  const agents = agentsOf(r);
  const sentiment = r.sentiment ?? null;
  const tone = sentimentTone(sentiment);
  const statusTone = r.status === 'failed' ? 'red' : live ? 'green' : 'blue';
  const statusText = r.status === 'finished' ? 'finished' : r.status === 'failed' ? 'failed' : r.status === 'evaluating' ? 'judging' : 'live';
  return (
    <Link to={testPath(r.run_id)} className="card ws-row" data-live={live}>
      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
        <div className="ws-name">{testName(r)}</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{live ? 'Agents are in their browsers now. Open to watch.' : subLine(r)}</div>
      </div>
      <div className="ws-right">
        <Tag tone={statusTone} pulse={live}>{statusText}</Tag>
        <Num value={agents ?? '–'} label="agents" />
        <Num value={r.completed ?? '–'} label="completed" color={r.completed != null ? C.green : undefined} />
        <div style={{ width: 108 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: hasClearWinner(r) ? C.text : C.muted2, whiteSpace: 'nowrap' }}>{winnerLabel(r)}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{r.winner && r.confidence ? `${r.confidence} confidence` : live ? 'verdict pending' : 'winner'}</div>
        </div>
        <div style={{ width: 84 }} title={SENTIMENT_HELP}>
          <div style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>Sentiment</div>
          <div className="progress-bar" style={{ margin: '8px 0 6px' }} role="img" aria-label={`Sentiment ${pct(sentiment)}`}>
            <div className="progress-fill" style={{ width: `${Math.round((sentiment ?? 0) * 100)}%`, background: TONE_COLOR[tone] }} />
          </div>
          <div className="mono" style={{ fontSize: 11, textAlign: 'right', color: TONE_COLOR[tone] }}>{pct(sentiment)}</div>
        </div>
      </div>
    </Link>
  );
}

function Num({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 56 }}>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: color ?? C.text }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Totals({ runs, liveCount }: { runs: RunSummary[]; liveCount: number }) {
  const finished = runs.filter((r) => r.status === 'finished');
  const agentsRun = runs.reduce((n, r) => n + (r.sessions ?? 0), 0);
  const withCompletion = finished.filter((r) => r.completed != null && (r.sessions ?? 0) > 0);
  const avgCompletion = withCompletion.length ? withCompletion.reduce((n, r) => n + r.completed! / r.sessions!, 0) / withCompletion.length : null;
  const clear = finished.filter(hasClearWinner).length;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const tiles: { label: string; value: string; note: string }[] = [
    { label: 'Agents run', value: agentsRun.toLocaleString(), note: 'each in its own browser' },
    { label: 'Avg. completion', value: pct(avgCompletion), note: withCompletion.length ? `across ${plural(withCompletion.length, 'finished test')}` : 'no finished tests with data yet' },
    { label: 'Clear winners', value: String(clear), note: `of ${plural(finished.length, 'finished test')}` },
    { label: 'Tests run', value: String(runs.length), note: liveCount ? `${liveCount} running now` : 'none running now' },
  ];
  return (
    <section aria-label="Totals" className="ws-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="card" style={{ padding: '20px 20px 18px' }}>
          <div style={{ fontSize: 12, color: C.muted }}>{t.label}</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', margin: '12px 0 10px', lineHeight: 1 }}>{t.value}</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>{t.note}</div>
        </div>
      ))}
    </section>
  );
}

const CSS = `
.ws-wrap { max-width: 1040px; margin: 0 auto; padding: 56px 24px 80px; }
.ws-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 32px; padding: 22px 24px; text-decoration: none; color: #e8eaf0; transition: border-color 0.15s, background 0.15s; }
.ws-row:hover { border-color: #252a38; background: #13161c; }
.ws-row[data-live="true"] { border-color: rgba(74,222,128,0.5); background: rgba(74,222,128,0.04); }
.ws-name { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-right { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 28px; }
.ws-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 28px; }
@media (max-width: 820px) { .ws-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) {
  .ws-wrap { padding: 32px 16px 64px; }
  .ws-row { padding: 18px 16px; }
  .ws-name { white-space: normal; }
  .ws-name { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-right { gap: 14px 20px; width: 100%; }
}
`;
