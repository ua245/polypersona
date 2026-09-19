// The Live tab: counts, sentiment, then every agent working, then how far each one got.
import { useMemo, useState, type ReactNode } from 'react';
import { sessionList, type RunState, type SessionState } from '../../lib/api';
import { SENTIMENT_HELP, agentState, avatarColor, initials, pct, runCounts, sentimentOf, sentimentTone, variantName, type AgentState, isSingleSite } from '../../lib/derive';
import { C, Empty, Tag } from '../../lib/ui';
import Crowd from '../../components/Crowd';
import AgentCard from './live/AgentCard';
import PanelActivity from './live/PanelActivity';

const TONE_COLOR = { muted: C.muted2, green: C.green, yellow: C.yellow, blue: C.blue, red: C.red } as const;
type StateFilter = 'all' | Exclude<AgentState, 'starting'>;

function StatTile({ label, value, color, hint }: { label: string; value: number; color: string; hint: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.muted2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.15, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</div>
    </div>
  );
}

function Bar({ value, height = 4 }: { value: number | null; height?: number }) {
  return (
    <div aria-hidden="true" style={{ flex: 1, minWidth: 60, height, background: C.border, borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round((value ?? 0) * 100)}%`, height: '100%', background: TONE_COLOR[sentimentTone(value)], borderRadius: height, transition: 'width 0.4s' }} />
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{
      fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 600 : 500, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
      background: on ? C.green : 'transparent', color: on ? C.bg : C.muted2, border: `1px solid ${on ? C.green : C.border}`,
    }}>{children}</button>
  );
}

const firstSentences = (text: string, n: number) => text.split(/(?<=[.!?])\s+/).slice(0, n).join(' ');

export default function LiveTab({ run, onOpenResults }: { run: RunState; onOpenResults: () => void }) {
  const sessions = useMemo(() => sessionList(run), [run]);
  const counts = runCounts(run);
  // config.variants only describes demo shop tests; a test of your own site has the variants it actually ran.
  const variants = useMemo(() => [...new Set([...(run.config.url_a ? [] : run.config.variants ?? []), ...sessions.map((s) => s.variant)])].sort(), [run.config.url_a, run.config.variants, sessions]);
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [variantFilter, setVariantFilter] = useState<string>('all');

  const overall = sentimentOf(sessions);
  const overallColor = TONE_COLOR[sentimentTone(overall)];

  const visible = sessions.filter((s) => (stateFilter === 'all' || agentState(s) === stateFilter) && (variantFilter === 'all' || s.variant === variantFilter));
  const byPersona = new Map<string, SessionState[]>();
  for (const s of visible) byPersona.set(s.persona_id, [...(byPersona.get(s.persona_id) ?? []), s]);
  const groups = [...byPersona.values()];

  const stateChips: { key: StateFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.total },
    { key: 'active', label: 'Active', n: counts.active },
    { key: 'hesitating', label: 'Hesitating', n: counts.hesitating },
    { key: 'blocked', label: 'Blocked', n: counts.blocked },
    { key: 'done', label: 'Done', n: counts.done },
  ];

  const verdict = run.verdict;
  const winnerIsVariant = verdict != null && variants.includes(verdict.winner.toLowerCase());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{'.pp-agent-card{transition:border-color .15s,transform .15s}.pp-agent-card:hover{border-color:var(--pp-accent) !important}'}</style>

      {/* ---------- counts ---------- */}
      <div aria-live="polite" aria-label="Agent counts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <StatTile label="Active" value={counts.active} color={C.text} hint={counts.starting > 0 ? `${counts.starting} starting` : counts.active > 0 ? 'using the site right now' : 'nobody is on the site'} />
        <StatTile label="Done" value={counts.done} color={C.blue} hint="reached the goal" />
        <StatTile label="Blocked" value={counts.blocked} color={C.red} hint="gave up, out of patience, or crashed" />
        <StatTile label="Hesitating" value={counts.hesitating} color={C.yellow} hint="last action did nothing, or patience low" />
      </div>

      {/* ---------- sentiment ---------- */}
      <section className="card" aria-label="Panel sentiment" title={SENTIMENT_HELP} style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Panel sentiment</span>
          <Bar value={overall} />
          <span className="mono" style={{ fontSize: 18, fontWeight: 500, color: overallColor, whiteSpace: 'nowrap' }}>{overall == null ? 'No data yet' : `${pct(overall)} positive`}</span>
        </div>
        {variants.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '6px 24px', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            {variants.map((v) => {
              const value = sentimentOf(sessions.filter((s) => s.variant === v));
              return (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, minWidth: 0 }}>
                  <span style={{ color: C.muted2, width: 170, flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{variantName(v, run.config)}</span>
                  <Bar value={value} height={3} />
                  <span className="mono" style={{ color: TONE_COLOR[sentimentTone(value)], width: 40, textAlign: 'right' }}>{value == null ? 'n/a' : pct(value)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- verdict / evaluating ---------- */}
      {verdict ? (
        <section className="card" aria-label="Verdict" style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 20px', borderColor: winnerIsVariant ? 'rgba(var(--pp-accent-rgb),0.35)' : C.border2 }}>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: winnerIsVariant ? C.green : C.text }}>
                {isSingleSite(run) ? (verdict.headline || 'The assessment is ready') : winnerIsVariant ? `Variant ${verdict.winner.toUpperCase()} wins` : 'No clear winner'}
              </span>
              <Tag tone={verdict.confidence === 'high' ? 'green' : verdict.confidence === 'medium' ? 'yellow' : 'muted'}>{verdict.confidence} confidence</Tag>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: C.muted2 }}>{firstSentences(verdict.rationale, 2)}</p>
          </div>
          <button type="button" className="btn-primary" onClick={onOpenResults}>See results →</button>
        </section>
      ) : run.status === 'evaluating' ? (
        <div role="status" className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.muted2 }}>
          <span className="dot-yellow" aria-hidden="true" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          Every agent has finished. The evaluator is reading their sessions…
        </div>
      ) : null}

      {sessions.some((s) => s.steps.length > 0) && (
        <Crowd sessions={sessions} runId={run.run_id} mode={run.status === 'finished' || run.status === 'failed' ? 'final' : 'live'}
          variantLabel={(v) => variantName(v, run.config)} caption={run.status === 'finished' || run.status === 'failed' ? 'Where every agent went' : 'following every agent'} />
      )}

      <PanelActivity runId={run.run_id} sessions={sessions} />

      {/* ---------- filters ---------- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        <div role="group" aria-label="Filter agents by state" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {stateChips.map((c) => <Chip key={c.key} on={stateFilter === c.key} onClick={() => setStateFilter(c.key)}>{c.label} ({c.n})</Chip>)}
        </div>
        {variants.length > 1 && (
          <div role="group" aria-label="Filter agents by variant" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>Variant</span>
            <Chip on={variantFilter === 'all'} onClick={() => setVariantFilter('all')}>All</Chip>
            {variants.map((v) => <Chip key={v} on={variantFilter === v} onClick={() => setVariantFilter(v)}>{v.toUpperCase()}</Chip>)}
          </div>
        )}
      </div>

      {/* ---------- agents, grouped by persona ---------- */}
      {sessions.length === 0 ? (
        <Empty title="Agents are being created">Each one gets its own container and browser. They appear here within a few seconds.</Empty>
      ) : groups.length === 0 ? (
        <Empty title="No agents match these filters">
          <button type="button" className="btn-ghost" style={{ color: C.green }} onClick={() => { setStateFilter('all'); setVariantFilter('all'); }}>Show all {counts.total} agents</button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 520px), 1fr))', gap: '18px 20px', alignItems: 'start' }}>
          {groups.map((group) => {
            const p = group[0]!;
            return (
              <section key={p.persona_id} aria-label={p.persona} style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, minWidth: 0 }} title={p.bio}>
                  <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', background: avatarColor(p.persona), color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(p.persona)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.persona}</span>
                  <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{p.device} · {p.savviness} savviness</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
                  {group.map((s) => <AgentCard key={s.session_id} runId={run.run_id} s={s} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

    </div>
  );
}
