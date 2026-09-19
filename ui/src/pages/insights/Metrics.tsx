// Side-by-side variant metrics. Every number here is computed in code from the recorded sessions, not by a model.
import { fmtTokens, type ObservationKind, type VariantMetrics } from '../../lib/api';
import { C, KIND_TONE, Tag } from '../../lib/ui';

type Better = 'lower' | 'higher' | 'neutral';
interface Row {
  label: string;
  better: Better;
  get: (m: VariantMetrics) => number | null | undefined;
  fmt: (n: number) => string;
  /** Fixed scale end for the bar. Without it the largest value in the row fills the bar. */
  max?: number;
}

const fixed = (d: number) => (n: number) => n.toFixed(d).replace(/\.0+$/, '');
const ROWS: Row[] = [
  { label: 'Completion rate', better: 'higher', get: (m) => m.completion_rate, fmt: (n) => `${Math.round(n * 100)}%`, max: 1 },
  { label: 'Mean actions', better: 'lower', get: (m) => m.mean_steps, fmt: fixed(1) },
  { label: 'Mean duration', better: 'lower', get: (m) => m.mean_duration_s, fmt: (n) => `${n.toFixed(1)} s` },
  { label: 'Dead clicks', better: 'lower', get: (m) => m.dead_clicks, fmt: fixed(0) },
  { label: 'Backtracks', better: 'lower', get: (m) => m.backtracks, fmt: fixed(0) },
  { label: 'Ease', better: 'higher', get: (m) => m.mean_ease, fmt: (n) => `${n.toFixed(1)} / 5`, max: 5 },
  { label: 'Trust', better: 'higher', get: (m) => m.mean_trust, fmt: (n) => `${n.toFixed(1)} / 5`, max: 5 },
  { label: 'Mean negative severity', better: 'lower', get: (m) => m.mean_negative_severity, fmt: (n) => `${n.toFixed(2)} / 5`, max: 5 },
  { label: 'Errors', better: 'lower', get: (m) => m.errors, fmt: fixed(0) },
  { label: 'Tokens', better: 'neutral', get: (m) => (m.input_tokens ?? 0) + (m.output_tokens ?? 0), fmt: (n) => fmtTokens(n) },
];

const HINT: Record<Better, string> = { lower: 'lower is better', higher: 'higher is better', neutral: 'cost, not quality' };
const KIND_ORDER: ObservationKind[] = ['bug', 'friction', 'confusion', 'opinion', 'delight'];

/** Index of the single best value, or -1 when the row is neutral, tied, or has fewer than two values. */
function bestIndex(values: (number | null)[], better: Better): number {
  if (better === 'neutral') return -1;
  const present = values.filter((v): v is number => v != null);
  if (present.length < 2) return -1;
  const target = better === 'lower' ? Math.min(...present) : Math.max(...present);
  if (present.every((v) => v === target)) return -1;
  return present.filter((v) => v === target).length === 1 ? values.indexOf(target) : -1;
}

export default function Metrics({ metrics, winner }: { metrics: VariantMetrics[]; winner?: string | null }) {
  const th = { padding: '10px 14px', fontSize: 11, fontWeight: 500, color: C.muted2, textAlign: 'left' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const };
  const td = { padding: '10px 14px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' as const };
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 200 + metrics.length * 150 }}>
        <caption style={{ captionSide: 'bottom', textAlign: 'left', padding: '10px 14px', fontSize: 12, color: C.muted }}>
          Computed in code from the recorded steps and exit surveys. The evaluator reads these numbers; it does not produce them. Green marks the better value in a row.
        </caption>
        <thead>
          <tr>
            <th scope="col" style={th}>Metric</th>
            {metrics.map((m) => (
              <th key={m.variant_id} scope="col" style={th}>
                <span className="mono" style={{ color: C.text, fontSize: 13, textTransform: 'uppercase' }}>Variant {m.variant_id}</span>
                {winner === m.variant_id && <span style={{ color: C.green, marginLeft: 8 }}>winner</span>}
                <span style={{ marginLeft: 8, color: C.muted }}>{m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const values = metrics.map((m) => row.get(m) ?? null);
            const best = bestIndex(values, row.better);
            const scale = row.max ?? Math.max(0, ...values.map((v) => v ?? 0));
            return (
              <tr key={row.label}>
                <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 500, fontSize: 13 }}>
                  {row.label}
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{HINT[row.better]}</div>
                </th>
                {values.map((v, i) => {
                  const isBest = i === best;
                  const pct = v == null || scale <= 0 ? 0 : Math.max(0, Math.min(100, (v / scale) * 100));
                  return (
                    <td key={metrics[i].variant_id} style={td}>
                      <div className="mono" style={{ fontSize: 14, color: v == null ? C.muted : isBest ? C.green : C.text }}>
                        {v == null ? '–' : row.fmt(v)}
                        {isBest && <span style={{ fontSize: 10, marginLeft: 6, fontFamily: 'Inter, sans-serif' }}>better</span>}
                      </div>
                      <div aria-hidden="true" style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 6, maxWidth: 220 }}>
                        <div style={{ height: '100%', width: `${pct}%`, minWidth: v ? 2 : 0, borderRadius: 2, background: isBest ? C.green : '#4b5563' }} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 500, fontSize: 13, borderBottom: 'none' }}>
              Observations
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>count by kind</div>
            </th>
            {metrics.map((m) => {
              const kinds = KIND_ORDER.filter((k) => (m.observations_by_kind?.[k] ?? 0) > 0);
              return (
                <td key={m.variant_id} style={{ ...td, borderBottom: 'none' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {kinds.length === 0 ? <span style={{ color: C.muted }}>–</span> : kinds.map((k) => <Tag key={k} tone={KIND_TONE[k]}>{m.observations_by_kind[k]} {k}</Tag>)}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
