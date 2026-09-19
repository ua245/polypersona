// Your tests, as an analytics view: headline numbers, completion per test, how verdicts split, then
// a sortable table of every test.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { fmtTime, useRuns, type RunStatus, type RunSummary } from '../lib/api';
import { SENTIMENT_HELP, pct, sentimentTone, testName, testPath } from '../lib/derive';
import { C } from '../lib/ui';
import { Eyebrow } from './newtest/bits';

const isLive = (s: RunStatus) => s === 'starting' || s === 'running' || s === 'evaluating';
const TONE_COLOR = { green: C.green, yellow: C.yellow, red: C.red, muted: C.muted } as const;
const hasClearWinner = (r: RunSummary) => !!r.winner && r.winner.length <= 2;
const completionOf = (r: RunSummary) => (r.sessions && r.completed != null ? r.completed / r.sessions : null);
const isSingle = (r: RunSummary) => r.winner === 'single site' || (r.variants?.length ?? 0) === 1;

type Verdict = 'winner' | 'none' | 'assessed' | 'pending' | 'failed';
function verdictOf(r: RunSummary): Verdict {
  if (r.status === 'failed') return 'failed';
  if (isLive(r.status) || !r.winner) return 'pending';
  if (isSingle(r)) return 'assessed';
  return hasClearWinner(r) ? 'winner' : 'none';
}
const VERDICT_META: Record<Verdict, { label: string; color: string }> = {
  winner: { label: 'Clear winner', color: C.green },
  none: { label: 'No clear winner', color: C.muted },
  assessed: { label: 'Single site assessed', color: C.blue },
  pending: { label: 'In progress', color: C.border2 },
  failed: { label: 'Failed', color: C.red },
};

/** "16:04" for today, "Sep 18" before that; the full time is in the title. */
function shortTime(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type SortKey = 'created' | 'name' | 'agents' | 'completion' | 'sentiment';
type Filter = 'all' | 'live' | 'ab' | 'single';

export default function Workspace() {
  const { runs, error } = useRuns();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'created', dir: -1 });

  const all = useMemo(() => runs ?? [], [runs]);
  const liveCount = all.filter((r) => isLive(r.status)).length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const val = (r: RunSummary): number | string => sort.key === 'name' ? testName(r).toLowerCase() : sort.key === 'agents' ? r.sessions ?? -1
      : sort.key === 'completion' ? completionOf(r) ?? -1 : sort.key === 'sentiment' ? r.sentiment ?? -1 : r.created_at ?? 0;
    return all
      .filter((r) => filter === 'all' || (filter === 'live' ? isLive(r.status) : filter === 'single' ? isSingle(r) : !isSingle(r)))
      .filter((r) => !q || testName(r).toLowerCase().includes(q) || (r.personas ?? []).some((p) => p.toLowerCase().includes(q)))
      .sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [all, filter, query, sort]);

  const setSortKey = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1 }));

  return (
    <div className="an-wrap">
      <style>{CSS}</style>
      <header className="an-head">
        <div>
          <Eyebrow>Workspace</Eyebrow>
          <h1 className="an-title">Tests</h1>
          <p className="an-sub">Every persona panel you have run, with completion, verdicts and sentiment.</p>
        </div>
        <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 16px', fontSize: 13 }}>New test</Link>
      </header>

      {error && !runs && <div role="alert" className="an-panel" style={{ padding: 16, color: C.red, fontSize: 13 }}>Tests could not be loaded: {error}</div>}
      {!runs && !error && <div aria-busy="true" className="an-panel" style={{ height: 320, opacity: 0.5 }} />}

      {runs && runs.length === 0 && (
        <div className="an-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No tests yet</div>
          <p style={{ color: C.muted2, fontSize: 14, margin: '8px auto 20px', maxWidth: 420, lineHeight: 1.6 }}>Run a persona panel against a site to see completion, verdicts and sentiment here.</p>
          <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 16px', fontSize: 13 }}>Start a test</Link>
        </div>
      )}

      {runs && runs.length > 0 && (
        <>
          <Kpis runs={all} liveCount={liveCount} />
          <div className="an-charts">
            <CompletionChart runs={all} />
            <VerdictSplit runs={all} />
          </div>

          <section className="an-panel" aria-label="All tests">
            <div className="an-toolbar">
              <div className="an-seg" role="group" aria-label="Filter tests">
                {([['all', 'All', all.length], ['live', 'Running', liveCount], ['ab', 'A/B', all.filter((r) => !isSingle(r)).length], ['single', 'Single site', all.filter(isSingle).length]] as const).map(([k, label, n]) => (
                  <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} <span className="mono">{n}</span></button>
                ))}
              </div>
              <input className="input an-search" type="search" placeholder="Search tests or personas" aria-label="Search tests or personas" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <Th k="name" sort={sort} onSort={setSortKey}>Test</Th>
                    <th>Status</th>
                    <Th k="agents" sort={sort} onSort={setSortKey} num>Agents</Th>
                    <Th k="completion" sort={sort} onSort={setSortKey}>Completion</Th>
                    <th>Verdict</th>
                    <Th k="sentiment" sort={sort} onSort={setSortKey}>Sentiment</Th>
                    <Th k="created" sort={sort} onSort={setSortKey}>Started</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => <Row key={r.run_id} r={r} />)}
                  {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: C.muted, padding: 28 }}>No tests match.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Th({ k, sort, onSort, num, children }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; num?: boolean; children: string }) {
  const on = sort.key === k;
  return (
    <th aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} style={num ? { textAlign: 'right' } : undefined}>
      <button type="button" className="an-sort" data-on={on} onClick={() => onSort(k)}>{children}<span aria-hidden="true">{on ? (sort.dir === 1 ? '↑' : '↓') : '↕'}</span></button>
    </th>
  );
}

function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="an-bar">
      <div className="an-bar-track"><div style={{ width: `${Math.round((value ?? 0) * 100)}%`, background: color }} /></div>
      <span className="mono">{pct(value)}</span>
    </div>
  );
}

function Row({ r }: { r: RunSummary }) {
  const navigate = useNavigate();
  const live = isLive(r.status);
  const v = verdictOf(r);
  const s = r.sentiment ?? null;
  const status = r.status === 'failed' ? 'Failed' : r.status === 'evaluating' ? 'Evaluating' : live ? 'Running' : 'Finished';
  const statusTone = r.status === 'failed' ? 'red' : live ? 'accent' : 'muted';
  const people = r.personas ?? [];
  return (
    <tr className="an-row" onClick={() => navigate(testPath(r.run_id))}>
      <td className="an-name">
        <Link to={testPath(r.run_id)} onClick={(e) => e.stopPropagation()}>{testName(r)}</Link>
        <span>{people.length ? people.slice(0, 3).join(', ') + (people.length > 3 ? ` +${people.length - 3}` : '') : '—'}</span>
      </td>
      <td><span className="an-status" data-tone={statusTone}><i />{status}</span></td>
      <td className="mono" style={{ textAlign: 'right' }}>{r.sessions ?? '—'}</td>
      <td><Bar value={completionOf(r)} color={C.green} /></td>
      <td>
        <span className="an-verdict"><i style={{ background: VERDICT_META[v].color }} />
          {v === 'winner' ? `Variant ${r.winner!.toUpperCase()} wins` : VERDICT_META[v].label}
          {r.confidence && v !== 'pending' && v !== 'failed' && <em>{r.confidence}</em>}
        </span>
      </td>
      <td title={SENTIMENT_HELP}><Bar value={s} color={TONE_COLOR[sentimentTone(s)]} /></td>
      <td className="mono an-date" title={fmtTime(r.created_at)}>{shortTime(r.created_at)}</td>
    </tr>
  );
}

function Kpis({ runs, liveCount }: { runs: RunSummary[]; liveCount: number }) {
  const finished = runs.filter((r) => r.status === 'finished');
  const withCompletion = finished.filter((r) => completionOf(r) != null);
  const avg = withCompletion.length ? withCompletion.reduce((n, r) => n + completionOf(r)!, 0) / withCompletion.length : null;
  const sentiments = finished.map((r) => r.sentiment).filter((x): x is number => x != null);
  const avgSent = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : null;
  const ab = finished.filter((r) => !isSingle(r));
  const tiles = [
    { label: 'Tests', value: String(runs.length), note: liveCount ? `${liveCount} running now` : `${finished.length} finished` },
    { label: 'Agents run', value: runs.reduce((n, r) => n + (r.sessions ?? 0), 0).toLocaleString(), note: 'one browser each' },
    { label: 'Avg. completion', value: pct(avg), note: `over ${withCompletion.length} finished tests` },
    { label: 'Avg. sentiment', value: pct(avgSent), note: 'ease and trust, 0–100%' },
    { label: 'A/B tests with a winner', value: ab.length ? `${ab.filter(hasClearWinner).length} / ${ab.length}` : '—', note: 'decided with evidence' },
  ];
  return (
    <section aria-label="Summary" className="an-kpis">
      {tiles.map((t) => (
        <div key={t.label} className="an-kpi">
          <div className="an-kpi-label">{t.label}</div>
          <div className="an-kpi-n mono">{t.value}</div>
          <div className="an-kpi-note">{t.note}</div>
        </div>
      ))}
    </section>
  );
}

/** One series (completion rate) over the most recent finished tests, oldest on the left. */
function CompletionChart({ runs }: { runs: RunSummary[] }) {
  const data = runs.filter((r) => r.status === 'finished' && completionOf(r) != null).sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0)).slice(-14);
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 150, L = 34, R = 8, T = 8, B = 22;
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / Math.max(data.length, 1);
  const bw = Math.min(26, slot * 0.62);
  const y = (v: number) => T + plotH - v * plotH;
  const avg = data.length ? data.reduce((n, r) => n + completionOf(r)!, 0) / data.length : null;
  return (
    <section className="an-panel an-chart" aria-label="Completion rate by test">
      <div className="an-chart-head">
        <div><h2>Completion rate by test</h2><p>Share of agents that reached the goal, most recent {data.length} finished tests</p></div>
        {avg != null && <div className="an-chart-stat"><span className="mono">{pct(avg)}</span><span>average</span></div>}
      </div>
      {data.length === 0 ? <p className="an-empty">No finished tests yet.</p> : (
        <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Completion rate for ${data.length} tests, average ${pct(avg)}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
            {[0, 0.5, 1].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke={C.border} strokeDasharray={g === 0 ? undefined : '3 4'} />
                <text x={L - 8} y={y(g) + 3.5} textAnchor="end" fontSize={10} fill={C.muted} className="mono">{g * 100}%</text>
              </g>
            ))}
            {data.map((r, i) => {
              const v = completionOf(r)!;
              const x = L + i * slot + (slot - bw) / 2;
              const h = Math.max(2, v * plotH);
              const top = T + plotH - h;
              const rad = Math.min(4, h / 2, bw / 2);
              return (
                <g key={r.run_id} onMouseEnter={() => setHover(i)}>
                  <rect x={L + i * slot} y={T} width={slot} height={plotH} fill="transparent" />
                  <path d={`M${x},${T + plotH} V${top + rad} Q${x},${top} ${x + rad},${top} H${x + bw - rad} Q${x + bw},${top} ${x + bw},${top + rad} V${T + plotH} Z`}
                    fill={C.green} opacity={hover == null || hover === i ? 1 : 0.45} />
                </g>
              );
            })}
            {data.length > 0 && <text x={L} y={H - 6} fontSize={10} fill={C.muted} className="mono">{shortTime(data[0]!.created_at)}</text>}
            {data.length > 1 && <text x={W - R} y={H - 6} fontSize={10} fill={C.muted} textAnchor="end" className="mono">{shortTime(data[data.length - 1]!.created_at)}</text>}
          </svg>
          {hover != null && data[hover] && (
            <div className="an-tip" style={{ left: `${((L + hover * slot + slot / 2) / W) * 100}%`, top: `${(y(completionOf(data[hover])!) / H) * 100}%` }}>
              <b>{testName(data[hover])}</b>
              <span className="mono">{pct(completionOf(data[hover]))} · {data[hover].completed}/{data[hover].sessions} agents</span>
              <span>{fmtTime(data[hover].created_at)}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function VerdictSplit({ runs }: { runs: RunSummary[] }) {
  const order: Verdict[] = ['winner', 'none', 'assessed', 'pending', 'failed'];
  const counts = order.map((v) => ({ v, n: runs.filter((r) => verdictOf(r) === v).length })).filter((c) => c.n > 0);
  const total = runs.length || 1;
  return (
    <section className="an-panel an-chart" aria-label="Verdicts">
      <div className="an-chart-head"><div><h2>Verdicts</h2><p>How each test ended</p></div></div>
      <div className="an-stack" role="img" aria-label={counts.map((c) => `${VERDICT_META[c.v].label}: ${c.n}`).join(', ')}>
        {counts.map((c) => <div key={c.v} title={`${VERDICT_META[c.v].label}: ${c.n}`} style={{ flex: c.n, background: VERDICT_META[c.v].color }} />)}
      </div>
      <ul className="an-legend">
        {counts.map((c) => (
          <li key={c.v}>
            <i style={{ background: VERDICT_META[c.v].color }} />
            <span>{VERDICT_META[c.v].label}</span>
            <span className="mono">{c.n}</span>
            <span className="mono an-legend-pct">{Math.round((c.n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CSS = `
.an-wrap { max-width: 1240px; margin: 0 auto; padding: 36px 24px 72px; display: flex; flex-direction: column; gap: 16px; }
.an-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; padding-bottom: 8px; }
.an-title { margin: 8px 0 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
.an-sub { margin: 4px 0 0; color: var(--pp-muted2); font-size: 14px; }
.an-panel { background: var(--pp-surface); border: 1px solid var(--pp-border); border-radius: 8px; }
.an-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); background: var(--pp-surface); border: 1px solid var(--pp-border); border-radius: 8px; }
.an-kpi { padding: 16px 18px; border-left: 1px solid var(--pp-border); min-width: 0; }
.an-kpi:first-child { border-left: 0; }
.an-kpi-label { font-size: 12px; color: var(--pp-muted2); }
.an-kpi-n { font-size: 26px; font-weight: 500; letter-spacing: -0.02em; margin: 8px 0 4px; color: var(--pp-text); }
.an-kpi-note { font-size: 11.5px; color: var(--pp-muted); }
.an-charts { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; }
.an-chart { padding: 16px 18px; }
.an-chart-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.an-chart-head h2 { margin: 0; font-size: 14px; font-weight: 600; }
.an-chart-head p { margin: 3px 0 0; font-size: 12px; color: var(--pp-muted); }
.an-chart-stat { text-align: right; display: flex; flex-direction: column; }
.an-chart-stat .mono { font-size: 20px; color: var(--pp-text); }
.an-chart-stat span:last-child { font-size: 11px; color: var(--pp-muted); }
.an-empty { color: var(--pp-muted); font-size: 13px; }
.an-tip { position: absolute; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none; z-index: 5; display: flex; flex-direction: column; gap: 2px; min-width: 180px; max-width: 260px;
  padding: 8px 10px; border-radius: 6px; background: var(--pp-glass); border: 1px solid var(--pp-border2); box-shadow: 0 8px 24px var(--pp-shadow); font-size: 11.5px; color: var(--pp-muted2); }
.an-tip b { color: var(--pp-text); font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.an-stack { display: flex; gap: 2px; height: 14px; border-radius: 4px; overflow: hidden; margin: 6px 0 16px; }
.an-legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.an-legend li { display: grid; grid-template-columns: 10px 1fr auto 44px; align-items: center; gap: 10px; font-size: 13px; color: var(--pp-text); }
.an-legend i { width: 10px; height: 10px; border-radius: 3px; }
.an-legend-pct { color: var(--pp-muted); text-align: right; }
.an-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--pp-border); }
.an-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 7px; background: var(--pp-bg); border: 1px solid var(--pp-border); }
.an-seg button { border: 0; border-radius: 5px; padding: 5px 11px; font: 500 12.5px 'Inter', sans-serif; cursor: pointer; background: transparent; color: var(--pp-muted2); }
.an-seg button .mono { font-size: 11px; opacity: 0.6; margin-left: 3px; }
.an-seg button[aria-pressed="true"] { background: var(--pp-surface2); color: var(--pp-text); box-shadow: 0 1px 2px var(--pp-shadow); }
.an-search { max-width: 260px; font-size: 13px; padding: 7px 10px; }
.an-table-wrap { overflow-x: auto; }
.an-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.an-table th { text-align: left; font-weight: 500; font-size: 11.5px; color: var(--pp-muted); padding: 9px 14px; border-bottom: 1px solid var(--pp-border); white-space: nowrap; background: var(--pp-surface); }
.an-table td { padding: 11px 14px; border-bottom: 1px solid var(--pp-border); vertical-align: middle; white-space: nowrap; }
.an-table tbody tr:last-child td { border-bottom: 0; }
.an-row { cursor: pointer; transition: background .12s; }
.an-row:hover { background: var(--pp-surface2); }
.an-sort { background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; display: inline-flex; gap: 5px; align-items: center; }
.an-sort span { opacity: 0.45; font-size: 10px; }
.an-sort[data-on="true"] { color: var(--pp-text); }
.an-sort[data-on="true"] span { opacity: 1; }
.an-name { max-width: 340px; }
.an-name a { display: block; color: var(--pp-text); font-weight: 600; text-decoration: none; overflow: hidden; text-overflow: ellipsis; }
.an-name a:hover { text-decoration: underline; text-underline-offset: 3px; }
.an-name span { display: block; font-size: 12px; color: var(--pp-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
.an-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--pp-muted2); }
.an-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--pp-muted); }
.an-status[data-tone="accent"] { color: var(--pp-accent); } .an-status[data-tone="accent"] i { background: var(--pp-accent); animation: pp-pulse 1.2s ease-in-out infinite; }
.an-status[data-tone="red"] { color: var(--pp-red); } .an-status[data-tone="red"] i { background: var(--pp-red); }
.an-bar { display: flex; align-items: center; gap: 8px; min-width: 130px; }
.an-bar-track { flex: 1; height: 6px; border-radius: 3px; background: var(--pp-border); overflow: hidden; }
.an-bar-track > div { height: 100%; border-radius: 3px; }
.an-bar .mono { width: 36px; text-align: right; font-size: 12px; color: var(--pp-text); }
.an-verdict { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--pp-text); }
.an-verdict i { width: 8px; height: 8px; border-radius: 2px; flex: none; }
.an-verdict em { font-style: normal; font-size: 11px; color: var(--pp-muted); padding: 1px 6px; border: 1px solid var(--pp-border); border-radius: 4px; }
.an-date { font-size: 12px; color: var(--pp-muted2); }
@media (max-width: 1000px) { .an-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } .an-kpi:nth-child(4) { border-left: 0; } .an-kpi:nth-child(n+4) { border-top: 1px solid var(--pp-border); } .an-charts { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 600px) { .an-wrap { padding: 24px 16px 56px; } .an-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .an-kpi { border-left: 0; border-top: 1px solid var(--pp-border); } .an-search { max-width: none; width: 100%; } }
`;
