// /workspace — every run so far, live ones first, with the way into each view of a run.
import { Link } from 'react-router';
import { fmtTime, fmtTokens, useRuns, type RunSummary } from '../lib/api';
import { C, Empty, Page, RunStatusTag, SectionLabel, Tag } from '../lib/ui';

const isLive = (r: RunSummary) => r.status === 'starting' || r.status === 'running' || r.status === 'evaluating';
const hasClearWinner = (r: RunSummary) => !!r.winner && r.winner.trim().toLowerCase() !== 'no clear winner';

const host = (url: string) => { try { return new URL(url).host + new URL(url).pathname.replace(/\/$/, ''); } catch { return url; } };

function Target({ run }: { run: RunSummary }) {
  const c = run.config;
  if (c?.url_a || c?.url_b) {
    return (
      <span title={`${c.url_a ?? ''} vs ${c.url_b ?? ''}`}>
        <span className="mono" style={{ fontSize: 12 }}>{c.url_a ? host(c.url_a) : '?'}</span>
        <span style={{ color: C.muted }}> vs </span>
        <span className="mono" style={{ fontSize: 12 }}>{c.url_b ? host(c.url_b) : '?'}</span>
      </span>
    );
  }
  if (c?.variants?.length) {
    return <span>Demo shop <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>{c.variants.join(' vs ')}</span></span>;
  }
  return <span style={{ color: C.muted }}>not recorded</span>;
}

function Winner({ run }: { run: RunSummary }) {
  if (!run.winner) return <span style={{ color: C.muted }}>{run.status === 'failed' ? '–' : isLive(run) ? 'pending' : '–'}</span>;
  const tone = run.confidence === 'high' ? 'green' : run.confidence === 'medium' ? 'yellow' : 'muted';
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      {hasClearWinner(run)
        ? <span style={{ color: C.green, fontWeight: 600 }}>Variant {run.winner.toUpperCase()}</span>
        : <span>No clear winner</span>}
      {run.confidence && <Tag tone={tone}>{run.confidence}</Tag>}
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: C.muted2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

export default function Workspace() {
  const { runs, error } = useRuns();
  const newTest = <Link to="/tools" className="btn-primary" style={{ textDecoration: 'none' }}>New test</Link>;

  if (runs == null) {
    return (
      <Page title="Workspace" subtitle="Every test you have run, and where each one stands." actions={newTest}>
        {error ? <Empty title="Could not load runs">{error}</Empty> : <Empty title="Loading runs…" />}
      </Page>
    );
  }

  const ordered = [...runs].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || (b.created_at ?? 0) - (a.created_at ?? 0));
  const liveCount = runs.filter(isLive).length;
  const finished = runs.filter((r) => r.status === 'finished').length;
  const sessions = runs.reduce((n, r) => n + (r.sessions ?? 0), 0);
  const tokens = runs.reduce((n, r) => n + (r.tokens ?? 0), 0);
  const clear = runs.filter(hasClearWinner).length;

  const th = { padding: '10px 14px', fontSize: 11, fontWeight: 500, color: C.muted2, textAlign: 'left' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const };
  const td = { padding: '12px 14px', fontSize: 13, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const };
  const link = { color: C.green, textDecoration: 'none', fontSize: 12 };

  return (
    <Page title="Workspace" subtitle="Every test you have run, and where each one stands." actions={newTest}>
      {error && <div role="alert" style={{ color: C.yellow, fontSize: 12, marginBottom: 12 }}>The list may be out of date: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 32 }}>
        <Stat label="Runs" value={String(runs.length)} note={liveCount > 0 ? `${liveCount} live now` : `${finished} finished`} />
        <Stat label="Sessions run" value={String(sessions)} note="one container each" />
        <Stat label="Runs with a clear winner" value={String(clear)} note={finished > 0 ? `of ${finished} finished` : undefined} />
        <Stat label="Total tokens" value={fmtTokens(tokens)} note="agents and evaluator" />
      </div>

      <SectionLabel>Runs</SectionLabel>
      {runs.length === 0 ? (
        <Empty title="No tests yet">
          Pick personas, point them at two variants, and watch them work. <Link to="/tools" style={{ color: C.green }}>Set up the first test</Link>
        </Empty>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Created</th>
                <th scope="col" style={th}>Status</th>
                <th scope="col" style={th}>Target</th>
                <th scope="col" style={{ ...th, textAlign: 'right' }}>Sessions</th>
                <th scope="col" style={th}>Winner</th>
                <th scope="col" style={{ ...th, textAlign: 'right' }}>Tokens</th>
                <th scope="col" style={th}>Open</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((r) => {
                const q = `?run=${encodeURIComponent(r.run_id)}`;
                const live = isLive(r);
                return (
                  <tr key={r.run_id} style={live ? { background: 'rgba(250,204,21,0.03)' } : undefined}>
                    <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 500 }}>
                      {live && <span className="dot-yellow" aria-hidden="true" style={{ marginRight: 8, animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
                      {fmtTime(r.created_at) || <span style={{ color: C.muted }}>time not recorded</span>}
                      <div className="mono" style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{r.run_id}</div>
                    </th>
                    <td style={td}><RunStatusTag status={r.status} /></td>
                    <td style={{ ...td, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}><Target run={r} /></td>
                    <td className="mono" style={{ ...td, textAlign: 'right', fontSize: 12 }}>{r.sessions ?? '–'}</td>
                    <td style={td}><Winner run={r} /></td>
                    <td className="mono" style={{ ...td, textAlign: 'right', fontSize: 12 }}>{fmtTokens(r.tokens)}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', gap: 14 }}>
                        <Link to={`/tools${q}`} style={link} aria-label={`Monitor run ${r.run_id}`}>Monitor</Link>
                        <Link to={`/populations${q}`} style={link} aria-label={`Agents in run ${r.run_id}`}>Agents</Link>
                        <Link to={`/insights${q}`} style={link} aria-label={`Insights for run ${r.run_id}`}>Insights</Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
