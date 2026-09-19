// Your tests: totals up top, then one card per test, live ones first.
import { Link } from 'react-router';
import { fmtTime, useRuns, type RunStatus, type RunSummary } from '../lib/api';
import { SENTIMENT_HELP, avatarColor, initials, pct, sentimentTone, testName, testPath } from '../lib/derive';
import { C } from '../lib/ui';
import { Eyebrow } from './newtest/bits';

const isLive = (s: RunStatus) => s === 'starting' || s === 'running' || s === 'evaluating';
const TONE_COLOR = { green: C.green, yellow: C.yellow, red: C.red, muted: C.muted } as const;
const hasClearWinner = (r: RunSummary) => !!r.winner && r.winner.length <= 2;

export default function Workspace() {
  const { runs, error } = useRuns();
  const sorted = runs ? [...runs].sort((a, b) => Number(isLive(b.status)) - Number(isLive(a.status)) || (b.created_at ?? 0) - (a.created_at ?? 0)) : null;
  const liveCount = sorted?.filter((r) => isLive(r.status)).length ?? 0;

  return (
    <div className="ws-wrap">
      <style>{CSS}</style>
      <header className="ws-head">
        <div>
          <Eyebrow>Workspace</Eyebrow>
          <h1 className="ws-title">Your tests</h1>
          <p style={{ margin: '8px 0 0', color: C.muted2, fontSize: 15 }}>Every crowd you've sent through a site, and what they found.</p>
        </div>
        <Link to="/new" className="btn-primary ws-cta">New test</Link>
      </header>

      {sorted && sorted.length > 0 && <Totals runs={sorted} liveCount={liveCount} />}

      {error && !sorted && <div role="alert" className="card" style={{ padding: 20, color: C.red, fontSize: 13 }}>Your tests could not be loaded: {error}</div>}
      {!sorted && !error && <div aria-busy="true" className="ws-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card ws-skel" />)}</div>}

      {sorted && sorted.length === 0 && (
        <div className="card ws-empty">
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>No tests yet</div>
          <p style={{ color: C.muted2, fontSize: 14, margin: '8px auto 24px', maxWidth: 420, lineHeight: 1.6 }}>
            Give a crowd of personas your site. In about three minutes you'll know where they got stuck, with screenshots to prove it.
          </p>
          <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 14 }}>Start your first test</Link>
        </div>
      )}

      {sorted && sorted.length > 0 && (
        <>
          <div className="ws-section mono">
            {liveCount > 0 ? <><span className="dot-green" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} /><span style={{ color: C.green }}>{liveCount} running now</span><span>·</span></> : null}
            <span>{sorted.length} tests</span>
          </div>
          <ul className="ws-grid">
            {sorted.map((r) => <li key={r.run_id}><TestCard r={r} /></li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function Ring({ value, size = 58, label }: { value: number | null; size?: number; label: string }) {
  const r = size / 2 - 5;
  const len = 2 * Math.PI * r;
  return (
    <div className="ws-ring" style={{ width: size, height: size }} role="img" aria-label={`${label} ${pct(value)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={5} />
        {value != null && value > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.green} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, value) * len} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      </svg>
      <span className="mono">{value == null ? '–' : `${Math.round(value * 100)}%`}</span>
    </div>
  );
}

function TestCard({ r }: { r: RunSummary }) {
  const live = isLive(r.status);
  const failed = r.status === 'failed';
  const agents = r.sessions ?? null;
  const completion = agents && r.completed != null ? r.completed / agents : null;
  const sentiment = r.sentiment ?? null;
  const variants = r.variants ?? [];
  const single = r.winner === 'single site' || variants.length === 1;
  const people = r.personas ?? [];
  const status = failed ? 'failed' : r.status === 'evaluating' ? 'judging' : live ? 'live' : 'finished';

  return (
    <Link to={testPath(r.run_id)} className="ws-card" data-live={live} data-failed={failed}>
      <div className="ws-card-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className={`ws-status ${status}`}><span className="ws-status-dot" />{status}</span>
          <span className="mono" style={{ fontSize: 11, color: C.muted }}>{fmtTime(r.created_at)}</span>
        </div>

        <div className="ws-name" title={testName(r)}>{testName(r)}</div>

        <div className="ws-mid">
          <Ring value={completion} label="Completion" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: C.muted }}>{live ? 'In progress' : 'Reached the goal'}</div>
            <div className="mono" style={{ fontSize: 20, marginTop: 4 }}>
              <span style={{ color: C.text }}>{r.completed ?? '–'}</span><span style={{ color: C.muted }}> / {agents ?? '–'}</span>
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 6 }}>agents</span>
            </div>
          </div>
          <div className="ws-verdict">
            {live ? <span style={{ color: C.muted2 }}>verdict pending…</span>
              : single ? <><b>Assessed</b><span>{r.confidence ? `${r.confidence} confidence` : ''}</span></>
              : hasClearWinner(r) ? (
                <>
                  <span className="ws-ab">
                    {variants.map((v) => <i key={v} data-win={v === r.winner?.toLowerCase()}>{v.toUpperCase()}</i>)}
                  </span>
                  <span>{r.winner!.toUpperCase()} wins · {r.confidence}</span>
                </>
              ) : <><b>No clear winner</b><span>{r.confidence ? `${r.confidence} confidence` : ''}</span></>}
          </div>
        </div>

        <div className="ws-foot">
          <div className="ws-faces" aria-label={people.join(', ')}>
            {people.slice(0, 5).map((p) => <span key={p} title={p} style={{ background: avatarColor(p) }}>{initials(p)}</span>)}
            {people.length > 5 && <span className="more">+{people.length - 5}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 110 }} title={SENTIMENT_HELP}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
              <span>Sentiment</span><span className="mono" style={{ color: TONE_COLOR[sentimentTone(sentiment)] }}>{pct(sentiment)}</span>
            </div>
            <div className="ws-meter"><div style={{ width: `${Math.round((sentiment ?? 0) * 100)}%`, background: TONE_COLOR[sentimentTone(sentiment)] }} /></div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Totals({ runs, liveCount }: { runs: RunSummary[]; liveCount: number }) {
  const finished = runs.filter((r) => r.status === 'finished');
  const agentsRun = runs.reduce((n, r) => n + (r.sessions ?? 0), 0);
  const withCompletion = finished.filter((r) => r.completed != null && (r.sessions ?? 0) > 0);
  const avgCompletion = withCompletion.length ? withCompletion.reduce((n, r) => n + r.completed! / r.sessions!, 0) / withCompletion.length : null;
  const clear = finished.filter(hasClearWinner).length;
  const tiles = [
    { label: 'Agents sent', value: agentsRun.toLocaleString(), note: 'each in its own browser' },
    { label: 'Avg. completion', value: pct(avgCompletion), note: `across ${withCompletion.length} finished tests` },
    { label: 'Clear winners', value: String(clear), note: `of ${finished.length} finished tests` },
    { label: 'Tests', value: String(runs.length), note: liveCount ? `${liveCount} running now` : 'none running now' },
  ];
  return (
    <section aria-label="Totals" className="ws-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="ws-tile">
          <div style={{ fontSize: 12, color: C.muted }}>{t.label}</div>
          <div className="mono ws-tile-n">{t.value}</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>{t.note}</div>
        </div>
      ))}
    </section>
  );
}

const CSS = `
.ws-wrap { max-width: 1180px; margin: 0 auto; padding: 48px 24px 88px; }
.ws-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid var(--pp-border); }
.ws-title { margin: 10px 0 0; font-size: clamp(28px, 3.6vw, 36px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; }
.ws-cta { text-decoration: none; padding: 10px 18px; font-size: 14px; }
.ws-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 32px; }
.ws-tile { padding: 16px 18px; border-radius: 10px; background: var(--pp-surface); border: 1px solid var(--pp-border); }
.ws-tile-n { font-size: 28px; font-weight: 500; letter-spacing: -0.02em; margin: 10px 0 6px; line-height: 1; }
.ws-section { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--pp-muted); margin-bottom: 12px; }
.ws-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 12px; }
.ws-skel { height: 210px; opacity: 0.5; border-radius: 10px; }
.ws-empty { padding: 56px 24px; text-align: center; border-radius: 10px; }
.ws-card { display: block; height: 100%; text-decoration: none; color: var(--pp-text); border-radius: 10px; border: 1px solid var(--pp-border); background: var(--pp-surface); transition: border-color .15s, box-shadow .15s; }
.ws-card:hover { border-color: var(--pp-border2); box-shadow: 0 4px 16px var(--pp-shadow); }
.ws-card[data-live="true"] { border-color: rgba(var(--pp-accent-rgb),0.6); }
.ws-card[data-failed="true"] { border-color: rgba(var(--pp-red-rgb),0.45); }
.ws-card-in { height: 100%; padding: 16px 18px 14px; display: flex; flex-direction: column; gap: 14px; }
.ws-status { display: inline-flex; align-items: center; gap: 6px; font: 600 10.5px 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 5px; background: var(--pp-surface2); color: var(--pp-muted2); border: 1px solid var(--pp-border); }
.ws-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.ws-status.live, .ws-status.judging { color: var(--pp-accent); border-color: rgba(var(--pp-accent-rgb),0.35); }
.ws-status.live .ws-status-dot { animation: pp-pulse 1.2s ease-in-out infinite; }
.ws-status.finished { color: var(--pp-blue); border-color: rgba(var(--pp-blue-rgb),0.3); }
.ws-status.failed { color: var(--pp-red); border-color: rgba(var(--pp-red-rgb),0.35); }
.ws-name { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
.ws-mid { display: flex; align-items: center; gap: 14px; }
.ws-ring { position: relative; flex: none; }
.ws-ring > span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.ws-verdict { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; font-size: 11.5px; color: var(--pp-muted); text-align: right; }
.ws-verdict b { color: var(--pp-text); font-size: 13px; font-weight: 600; }
.ws-ab { display: inline-flex; gap: 4px; }
.ws-ab i { font: 700 11.5px 'JetBrains Mono', monospace; font-style: normal; width: 24px; height: 24px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--pp-surface2); color: var(--pp-muted); border: 1px solid var(--pp-border); }
.ws-ab i[data-win="true"] { background: var(--pp-accent); color: var(--pp-on-accent); border-color: transparent; }
.ws-foot { display: flex; align-items: center; gap: 16px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--pp-border); }
.ws-faces { display: flex; }
.ws-faces span { width: 24px; height: 24px; border-radius: 50%; color: #fff; font-size: 9px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; border: 2px solid var(--pp-surface); margin-left: -6px; }
.ws-faces span:first-child { margin-left: 0; }
.ws-faces .more { background: var(--pp-surface2); color: var(--pp-muted2); }
.ws-meter { height: 4px; border-radius: 4px; background: var(--pp-border); overflow: hidden; margin-top: 6px; }
.ws-meter > div { height: 100%; border-radius: 4px; transition: width .5s; }
@media (max-width: 820px) { .ws-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .ws-wrap { padding: 32px 16px 64px; } }
`;
