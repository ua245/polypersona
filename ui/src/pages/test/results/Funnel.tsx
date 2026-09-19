// Where each variant loses people. Stages are read from the pages the agents actually visited.
import type { RunState } from '../../../lib/api';
import { funnel, variantName } from '../../../lib/derive';
import { C } from '../../../lib/ui';
import { Bar, Panel, sessionsOf, variantsOf, winnerOf } from './shared';

export default function Funnel({ run }: { run: RunState }) {
  const variants = variantsOf(run);
  const winner = winnerOf(run);
  const per = variants.map((v) => { const sessions = sessionsOf(run, v); return { v, sessions, stages: funnel(sessions) }; });
  // Order: the variant with the most stages leads; stages only another variant has follow.
  const order: string[] = [];
  [...per].sort((a, b) => b.stages.length - a.stages.length).forEach((p) => p.stages.forEach((s) => { if (!order.includes(s.stage)) order.push(s.stage); }));
  if (order.length === 0) return <Panel><p style={{ margin: 0, fontSize: 13, color: C.muted2 }}>No agent recorded a step, so there is no funnel to draw.</p></Panel>;

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
      {per.map(({ v, sessions, stages }) => {
        const total = sessions.length;
        const done = sessions.filter((s) => s.outcome === 'completed').length;
        const rows = [
          ...order.map((stage) => ({ stage, reached: stages.find((s) => s.stage === stage)?.reached ?? 0, inFlow: stages.some((s) => s.stage === stage), goal: false })),
          { stage: 'Goal reached', reached: done, inFlow: true, goal: true },
        ];
        return (
          <Panel key={v} title={variantName(v, run.config)} hint={<>{total} {total === 1 ? 'agent' : 'agents'}{winner === v && <span style={{ color: C.green }}> · winner</span>}</>}>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
              {rows.map((r, i) => {
                const share = total ? r.reached / total : 0;
                const color = r.reached === total ? C.green : r.reached === 0 ? C.red : C.yellow;
                const skipped = !r.inFlow;
                return (
                  <li key={r.stage} style={{ display: 'grid', gridTemplateColumns: '16px minmax(84px, 1fr) minmax(60px, 1.4fr) 44px', gap: 10, alignItems: 'center', opacity: skipped ? 0.45 : 1, paddingTop: r.goal ? 10 : 0, borderTop: r.goal ? `1px solid ${C.border}` : 'none' }}>
                    <span className="mono" style={{ fontSize: 10, color: C.muted }}>{r.goal ? '' : i + 1}</span>
                    <span style={{ fontSize: 13, color: r.goal ? C.text : C.muted2, fontWeight: r.goal ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.stage}</span>
                    {skipped
                      ? <span style={{ fontSize: 11, color: C.muted }}>not part of this variant</span>
                      : <Bar value={share} color={color} />}
                    <span className="mono" style={{ fontSize: 11, color: skipped ? C.muted : color === C.green ? C.muted2 : color, textAlign: 'right' }}>{skipped ? '' : `${r.reached}/${total}`}</span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        );
      })}
    </div>
  );
}
