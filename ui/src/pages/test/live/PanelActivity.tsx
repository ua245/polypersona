// "What the panel is doing": where the running agents are, and the latest things any of them did.
import { Link } from 'react-router';
import type { SessionState, Step } from '../../../lib/api';
import { agentPath, agentState, currentStage } from '../../../lib/derive';
import { C } from '../../../lib/ui';

const RECENT = 3;
const ROW_H = 22;

const VERB: Record<Step['action'], string> = { open: 'opened the page', click: 'clicked', type_text: 'typed', scroll: 'scrolled', press_key: 'pressed a key', go_back: 'went back' };
const describe = (st: Step): string => st.note || (st.action === 'scroll' && st.args.direction ? `scrolled ${st.args.direction}` : VERB[st.action] ?? st.action);

/** Counts per label, in first-seen order. */
function tally(labels: string[]): { label: string; n: number }[] {
  const m = new Map<string, number>();
  labels.forEach((l) => m.set(l, (m.get(l) ?? 0) + 1));
  return [...m.entries()].map(([label, n]) => ({ label, n }));
}

function Counts({ items }: { items: { key: string; n: number; text: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: 13, lineHeight: 1.5 }}>
      {items.map((it, i) => (
        <span key={it.key} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 && <span aria-hidden="true" style={{ color: C.muted, marginRight: 8 }}>·</span>}
          <span className="mono" style={{ color: it.color, fontWeight: 500 }}>{it.n}</span> <span style={{ color: C.text }}>{it.text}</span>
        </span>
      ))}
    </div>
  );
}

export default function PanelActivity({ runId, sessions }: { runId: string; sessions: SessionState[] }) {
  if (!sessions.length) return null;
  const working = sessions.filter((s) => s.outcome == null);
  const heading = <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>{working.length ? 'What the panel is doing' : 'Where the panel ended'}</h2>;

  if (!working.length) {
    const reached = tally(sessions.filter((s) => agentState(s) === 'done').map(currentStage));
    const stopped = tally(sessions.filter((s) => agentState(s) === 'blocked').map(currentStage));
    return (
      <section className="card" aria-label="Where the panel ended" style={{ padding: '12px 16px' }}>
        {heading}
        <Counts items={[
          ...reached.map((r) => ({ key: `r-${r.label}`, n: r.n, text: `reached ${r.label}`, color: C.blue })),
          ...stopped.map((r) => ({ key: `s-${r.label}`, n: r.n, text: `stopped at ${r.label}`, color: C.red })),
        ]} />
      </section>
    );
  }

  const starting = working.filter((s) => agentState(s) === 'starting').length;
  const finished = sessions.length - working.length;
  const at = tally(working.filter((s) => agentState(s) !== 'starting').map(currentStage));
  const recent = sessions
    .flatMap((s) => s.steps.map((step) => ({ s, step })))
    .sort((a, b) => b.step.ts - a.step.ts || b.step.idx - a.step.idx)
    .slice(0, RECENT);

  return (
    <section className="card" aria-label="What the panel is doing" style={{ padding: '12px 16px' }}>
      {heading}
      <Counts items={[
        ...at.map((r) => ({ key: `a-${r.label}`, n: r.n, text: `at ${r.label}`, color: C.green })),
        ...(starting ? [{ key: 'starting', n: starting, text: 'starting', color: C.muted2 }] : []),
        ...(finished ? [{ key: 'finished', n: finished, text: 'finished', color: C.blue }] : []),
      ]} />
      <ol aria-label="Latest actions" style={{ listStyle: 'none', margin: '8px 0 0', padding: '8px 0 0', borderTop: `1px solid ${C.border}`, minHeight: RECENT * ROW_H + 9 }}>
        {recent.length === 0 && <li style={{ fontSize: 12, color: C.muted, lineHeight: `${ROW_H}px` }}>No actions yet. The first ones appear as soon as a browser opens.</li>}
        {recent.map(({ s, step }) => (
          <li key={`${s.session_id}-${step.idx}`} style={{ height: ROW_H }}>
            <Link to={agentPath(runId, s.session_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: ROW_H, fontSize: 12, textDecoration: 'none', color: C.muted2, minWidth: 0 }}>
              <span style={{ color: C.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.persona.split(/\s+/)[0]} · {s.variant.toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{describe(step)}</span>
              <span className="mono" style={{ fontSize: 11, color: step.changed ? C.muted : C.yellow, whiteSpace: 'nowrap' }}>{step.changed ? `step ${step.idx}` : 'nothing changed'}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
