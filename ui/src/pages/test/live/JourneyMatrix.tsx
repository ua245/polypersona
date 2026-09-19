// One row per agent, one column per stage: how far each agent got and where it had trouble.
import { Link } from 'react-router';
import type { SessionState } from '../../../lib/api';
import { agentPath, stageOf } from '../../../lib/derive';
import { C, SectionLabel } from '../../../lib/ui';
import { orderedStages, stageVisits } from './stages';

type CellKind = 'clear' | 'trouble' | 'stopped' | 'unreached';
interface Cell { kind: CellKind; title: string; firstIdx?: number; actions?: number; current?: boolean }

const CELL_STYLE: Record<CellKind, { background: string; border: string; color: string }> = {
  clear: { background: 'rgba(74,222,128,0.16)', border: 'rgba(74,222,128,0.45)', color: C.green },
  trouble: { background: 'rgba(250,204,21,0.16)', border: 'rgba(250,204,21,0.5)', color: C.yellow },
  stopped: { background: 'rgba(248,113,113,0.18)', border: 'rgba(248,113,113,0.6)', color: C.red },
  unreached: { background: 'transparent', border: C.border, color: C.muted },
};
const LEGEND: { kind: CellKind; label: string }[] = [
  { kind: 'clear', label: 'passed without trouble' },
  { kind: 'trouble', label: 'a problem of severity 3+ or an action that changed nothing' },
  { kind: 'stopped', label: 'the session ended here without reaching the goal' },
  { kind: 'unreached', label: 'never reached' },
];

function cellsFor(s: SessionState, stages: string[]): Cell[] {
  const visits = new Map(stageVisits(s).map((v) => [v.stage, v]));
  const stageByIdx = new Map(s.steps.map((st) => [st.idx, stageOf(st.url)]));
  const problems = new Map<string, number>();
  for (const o of s.observations) {
    if (o.kind === 'delight' || o.severity < 3) continue;
    const st = stageByIdx.get(o.step_idx);
    if (st) problems.set(st, (problems.get(st) ?? 0) + 1);
  }
  const lastStage = s.steps.length ? stageOf(s.steps[s.steps.length - 1]!.url) : null;
  const failed = s.outcome != null && s.outcome !== 'completed';
  const who = `${s.persona} on variant ${s.variant.toUpperCase()}`;

  return stages.map((stage) => {
    const v = visits.get(stage);
    if (!v) return { kind: 'unreached', title: `${who} never reached ${stage}.` };
    const n = problems.get(stage) ?? 0;
    const spent = `${v.actions} ${v.actions === 1 ? 'action' : 'actions'} at ${stage}`;
    const base = { firstIdx: v.firstIdx, actions: v.actions, current: s.outcome == null && stage === lastStage };
    if (failed && stage === lastStage) {
      const why = s.outcome === 'gave_up' ? 'gave up' : s.outcome === 'out_of_steps' ? 'ran out of patience' : 'crashed';
      return { ...base, kind: 'stopped', title: `${who} ${why} at ${stage} after ${spent}.` };
    }
    if (n > 0 || v.noChange > 0) {
      const parts = [n > 0 ? `${n} serious ${n === 1 ? 'problem' : 'problems'}` : '', v.noChange > 0 ? `${v.noChange} ${v.noChange === 1 ? 'action' : 'actions'} that changed nothing` : ''].filter(Boolean);
      return { ...base, kind: 'trouble', title: `${who}: ${parts.join(' and ')} at ${stage} (${spent}).` };
    }
    return { ...base, kind: 'clear', title: `${who} ${base.current ? 'is at' : 'passed'} ${stage} without trouble (${spent}).` };
  });
}

export default function JourneyMatrix({ runId, sessions }: { runId: string; sessions: SessionState[] }) {
  const stages = orderedStages(sessions);
  if (!stages.length) return null;
  const rows = [...sessions].sort((a, b) => a.variant.localeCompare(b.variant) || a.persona_id.localeCompare(b.persona_id) || a.repeat - b.repeat);
  const repeats = sessions.some((s) => s.repeat > 0);

  return (
    <section className="card" aria-labelledby="live-matrix" style={{ padding: 16, minWidth: 0 }}>
      <div id="live-matrix"><SectionLabel>Journey matrix</SectionLabel></div>
      <p style={{ margin: '-4px 0 12px', fontSize: 12, color: C.muted2, lineHeight: 1.5 }}>
        How far each agent got, stage by stage. The number in a cell is how many actions the agent spent there.
      </p>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '6px 5px', fontSize: 12, marginLeft: -6 }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left', fontWeight: 400, color: C.muted, fontSize: 11, paddingRight: 10 }}>Agent</th>
              {stages.map((st) => (
                <th key={st} scope="col" className="mono" style={{ fontWeight: 400, color: C.muted, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 64, textAlign: 'center' }}>{st}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const newVariant = i > 0 && rows[i - 1]!.variant !== s.variant;
              return (
                <tr key={s.session_id}>
                  <th scope="row" style={{ textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap', paddingRight: 10, paddingTop: newVariant ? 10 : 0 }}>
                    <Link to={agentPath(runId, s.session_id)} style={{ color: C.text, textDecoration: 'none' }}>
                      <span className="mono" style={{ color: C.muted2, fontSize: 11, marginRight: 8 }}>{s.variant.toUpperCase()}</span>
                      {s.persona.split(/\s+/)[0]}{repeats ? <span style={{ color: C.muted }}> #{s.repeat + 1}</span> : null}
                    </Link>
                  </th>
                  {cellsFor(s, stages).map((cell, j) => {
                    const look = CELL_STYLE[cell.kind];
                    const box = {
                      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, borderRadius: 5, textDecoration: 'none',
                      background: look.background, border: `1px ${cell.kind === 'unreached' ? 'dashed' : 'solid'} ${look.border}`, color: look.color, fontSize: 11,
                      animation: cell.current ? 'pp-pulse 1.4s ease-in-out infinite' : undefined,
                    } as const;
                    return (
                      <td key={stages[j]} style={{ padding: 0, paddingTop: newVariant ? 10 : 0 }}>
                        {cell.firstIdx != null
                          ? <Link to={agentPath(runId, s.session_id, cell.firstIdx)} title={cell.title} aria-label={cell.title} className="mono" style={box}>{cell.actions}</Link>
                          : <span title={cell.title} aria-label={cell.title} role="img" style={box} />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '10px 0 0', padding: 0, fontSize: 11, color: C.muted }}>
        {LEGEND.map((l) => (
          <li key={l.kind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: CELL_STYLE[l.kind].background, border: `1px ${l.kind === 'unreached' ? 'dashed' : 'solid'} ${CELL_STYLE[l.kind].border}` }} />
            {l.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
