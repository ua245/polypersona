// One agent in the Live grid: where it is, what it is thinking, what it sees, how much patience is left.
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { SessionState } from '../../../lib/api';
import { STATE_LABEL, STATE_TONE, agentPath, agentState, currentStage, type AgentState } from '../../../lib/derive';
import { C, KindTag, PatienceBar, Screenshot, Tag } from '../../../lib/ui';
import { StageIcon } from './stages';

const TONE_COLOR = { muted: C.muted2, green: C.green, yellow: C.yellow, blue: C.blue, red: C.red } as const;
const CARD_TINT: Record<AgentState, { border: string; background: string }> = {
  starting: { border: C.border, background: C.surface },
  active: { border: 'rgba(74,222,128,0.22)', background: C.surface },
  hesitating: { border: 'rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.035)' },
  blocked: { border: 'rgba(248,113,113,0.45)', background: 'rgba(248,113,113,0.045)' },
  done: { border: C.border2, background: C.surface },
};
const OUTCOME_LINE: Record<NonNullable<SessionState['outcome']>, string> = {
  completed: 'Reached the goal', gave_up: 'Gave up', out_of_steps: 'Ran out of patience', error: 'The session crashed',
};
const THUMB_H = 150;

const clamp = (lines: number): CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' });

export default function AgentCard({ runId, s }: { runId: string; s: SessionState }) {
  const state = agentState(s);
  const tone = STATE_TONE[state];
  const color = TONE_COLOR[tone];
  const tint = CARD_TINT[state];
  const stage = currentStage(s);
  const last = s.steps[s.steps.length - 1];
  const thought = [...s.steps].reverse().find((st) => st.reasoning)?.reasoning;
  const obs = s.observations[s.observations.length - 1];
  const used = Math.max(0, s.patience - s.actions_left);
  const running = s.status === 'running';

  return (
    <Link
      to={agentPath(runId, s.session_id)}
      aria-label={`${s.persona}, variant ${s.variant.toUpperCase()}: ${STATE_LABEL[state]}, at ${stage}. Open this agent.`}
      className="pp-agent-card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, padding: 12, borderRadius: 8, textDecoration: 'none', color: C.text,
        background: tint.background, border: `1px solid ${tint.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: C.text, background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '1px 6px' }}>{s.variant.toUpperCase()}</span>
        <span className="mono" style={{ fontSize: 11, color: C.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.session_id}</span>
        <Tag tone={tone}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: running ? 'pp-pulse 1.4s ease-in-out infinite' : undefined }} />
          {STATE_LABEL[state]}
        </Tag>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 54 }}>
        <span style={{ paddingTop: 1 }}><StageIcon stage={stage} color={color} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
            {stage}
            {s.outcome && <span style={{ fontWeight: 400, color: s.outcome === 'completed' ? C.blue : C.red }}> · {OUTCOME_LINE[s.outcome]}</span>}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: C.muted2, marginTop: 2, ...clamp(2) }}>
            {thought ?? (state === 'starting' ? 'Waiting for its container and browser.' : 'Looking at the page.')}
          </div>
        </div>
      </div>

      {last ? (
        <Screenshot runId={runId} sessionId={s.session_id} idx={last.idx} device={s.device} maxHeight={THUMB_H} style={{ height: THUMB_H, alignItems: 'center' }} />
      ) : (
        <div style={{ height: THUMB_H, borderRadius: 6, border: `1px dashed ${C.border2}`, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted, fontSize: 12 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: C.muted, animation: 'pp-pulse 1.4s ease-in-out infinite' }} />
          Starting container…
        </div>
      )}

      <div>
        <PatienceBar left={s.actions_left} total={s.patience || 1} />
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: C.muted, marginTop: 5 }}>
          <span>{used} {used === 1 ? 'action' : 'actions'}</span>
          <span style={{ color: s.actions_left / (s.patience || 1) < 0.25 ? C.red : C.muted }}>{s.actions_left} left</span>
        </div>
      </div>

      {obs && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 0 }}>
          <span style={{ flexShrink: 0 }}><KindTag kind={obs.kind} severity={obs.severity} /></span>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: C.muted2, minWidth: 0, ...clamp(2) }}>{obs.text}</span>
        </div>
      )}

      {s.exit_survey && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 'auto' }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: C.text, borderLeft: `2px solid ${color}`, paddingLeft: 10, ...clamp(3) }}>“{s.exit_survey.summary}”</div>
          <div className="mono" style={{ fontSize: 11, color: C.muted2, marginTop: 6 }}>
            ease {s.exit_survey.ease} · trust {s.exit_survey.trust}{s.exit_survey.would_return ? ' · would return' : ' · would not return'}
          </div>
        </div>
      )}
    </Link>
  );
}
