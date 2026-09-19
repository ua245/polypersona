// What to change, in priority order, judged against what the owner is trying to achieve.
import { Link } from 'react-router';
import type { RunState, Suggestion } from '../../../lib/api';
import { agentPath } from '../../../lib/derive';
import { C, Tag } from '../../../lib/ui';

const IMPACT_TONE = { high: 'green', medium: 'yellow', low: 'muted' } as const;
const EFFORT_TONE = { low: 'green', medium: 'yellow', high: 'red' } as const;

export default function Suggestions({ run, suggestions }: { run: RunState; suggestions: Suggestion[] }) {
  const objective = run.config.objective;
  const goal = Object.values(run.sessions)[0]?.goal;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {(objective || goal) && (
        <div className="card" style={{ padding: '12px 16px', fontSize: 13, color: C.muted2, lineHeight: 1.55 }}>
          {objective && <div><span style={{ color: C.text, fontWeight: 600 }}>Your objective:</span> {objective}</div>}
          {goal && <div><span style={{ color: C.text, fontWeight: 600 }}>What people were asked to do:</span> {goal}</div>}
        </div>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {suggestions.map((s, i) => (
          <li key={`${i}-${s.title}`} className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '4px 16px', borderColor: i === 0 ? 'rgba(var(--pp-accent-rgb),0.35)' : undefined }}>
            <span className="mono" aria-hidden="true" style={{ gridRow: '1 / span 4', width: 30, height: 30, borderRadius: '50%', border: `1px solid ${i === 0 ? C.green : C.border2}`, color: i === 0 ? C.green : C.muted2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{i + 1}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{s.title}</h3>
              {i === 0 && <Tag tone="green">do this first</Tag>}
              <Tag tone={IMPACT_TONE[s.impact] ?? 'muted'}>{s.impact} impact</Tag>
              <Tag tone={EFFORT_TONE[s.effort] ?? 'muted'}>{s.effort} effort</Tag>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.6, color: C.text }}>{s.change}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.6, color: C.muted2 }}><span style={{ color: C.green }}>Why it serves the goal:</span> {s.serves_goal}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'center', marginTop: 6, fontSize: 12, color: C.muted }}>
              {s.affected_personas.length > 0 && <span>Affects {s.affected_personas.join(', ')}</span>}
              {s.evidence.map((e) => {
                const [sid, step] = e.split('#');
                const known = sid != null && run.sessions[sid] != null;
                const label = <span className="mono" style={{ fontSize: 11 }}>{e}</span>;
                return known
                  ? <Link key={e} to={agentPath(run.run_id, sid!, step != null && /^\d+$/.test(step) ? Number(step) : undefined)} style={{ color: C.green, textDecoration: 'none', border: `1px solid ${C.border2}`, borderRadius: 4, padding: '1px 6px' }} title="Open this agent at that step">{label}</Link>
                  : <span key={e} style={{ border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>{label}</span>;
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
