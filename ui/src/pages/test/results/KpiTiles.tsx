// Four headline numbers, each shown per variant so the gap is the first thing you see.
import type { RunState } from '../../../lib/api';
import { SENTIMENT_HELP, pct, sentimentOf } from '../../../lib/derive';
import { C } from '../../../lib/ui';
import { NEGATIVE_KINDS, fmtDuration, sessionsOf, variantsOf } from './shared';

interface Kpi { label: string; better: 'higher' | 'lower'; hint: string; help?: string; values: (number | null)[]; fmt: (v: number | null) => string }

const pctOrNa = (v: number | null) => (v == null ? 'n/a' : pct(v));
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function colorsFor(values: (number | null)[], better: 'higher' | 'lower'): string[] {
  const present = values.filter((v): v is number => v != null);
  if (present.length < 2 || present.every((v) => v === present[0])) return values.map((v) => (v == null ? C.muted : C.text));
  const best = better === 'higher' ? Math.max(...present) : Math.min(...present);
  const worst = better === 'higher' ? Math.min(...present) : Math.max(...present);
  const wide = Math.abs(best - worst) / Math.max(Math.abs(best), Math.abs(worst), 1e-9) >= 0.25;
  return values.map((v) => (v == null ? C.muted : v === best ? C.green : v === worst && wide ? C.red : C.yellow));
}

export default function KpiTiles({ run }: { run: RunState }) {
  const variants = variantsOf(run);
  const per = variants.map((v) => ({ sessions: sessionsOf(run, v), metrics: run.metrics?.find((m) => m.variant_id === v) ?? null }));
  const kpis: Kpi[] = [
    {
      label: 'Completion', better: 'higher', hint: 'agents that reached the goal', fmt: pctOrNa,
      values: per.map(({ sessions, metrics }) => metrics?.completion_rate ?? (sessions.length ? sessions.filter((s) => s.outcome === 'completed').length / sessions.length : null)),
    },
    { label: 'Sentiment', better: 'higher', hint: 'ease and trust from exit surveys', help: SENTIMENT_HELP, fmt: pctOrNa, values: per.map(({ sessions }) => sentimentOf(sessions)) },
    {
      label: 'Avg. time', better: 'lower', hint: 'per agent, start to finish', fmt: fmtDuration,
      values: per.map(({ sessions, metrics }) => metrics?.mean_duration_s ?? mean(sessions.map((s) => s.duration_s).filter((d): d is number => d != null))),
    },
    {
      label: 'Friction', better: 'lower', hint: 'bugs, friction and confusion per agent', fmt: (v) => (v == null ? 'n/a' : v.toFixed(1)),
      values: per.map(({ sessions }) => (sessions.length ? sessions.reduce((n, s) => n + s.observations.filter((o) => NEGATIVE_KINDS.has(o.kind)).length, 0) / sessions.length : null)),
    },
  ];
  const big = variants.length > 2 ? 22 : 'clamp(24px, 2.6vw, 30px)';
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))' }}>
      {kpis.map((k) => {
        const colors = colorsFor(k.values, k.better);
        return (
          <div key={k.label} className="card" title={k.help} style={{ padding: '16px 18px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: C.muted2, textDecoration: k.help ? 'underline dotted' : 'none', textUnderlineOffset: 3, cursor: k.help ? 'help' : undefined }}>{k.label}</span>
              <span style={{ fontSize: 10, color: C.muted }}>{k.better} is better</span>
            </div>
            <dl style={{ display: 'flex', margin: '10px 0 0' }}>
              {variants.map((v, i) => (
                <div key={v} style={{ flex: '1 1 0', minWidth: 0, paddingLeft: i ? 14 : 0, marginLeft: i ? 14 : 0, borderLeft: i ? `1px solid ${C.border2}` : 'none' }}>
                  <dt className="mono" style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>{v.toUpperCase()}</dt>
                  <dd className="mono" style={{ margin: '2px 0 0', fontSize: big, fontWeight: 500, letterSpacing: '-0.03em', color: colors[i], whiteSpace: 'nowrap' }}>{k.fmt(k.values[i] ?? null)}</dd>
                </div>
              ))}
            </dl>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{k.hint}</div>
          </div>
        );
      })}
    </div>
  );
}
