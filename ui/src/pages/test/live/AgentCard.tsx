// One agent in the Live grid: what it sees (a mini browser), what it's thinking, how much patience
// is left, its latest complaint, and at the end its verdict on the site.
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { SessionState } from '../../../lib/api';
import { STATE_LABEL, STATE_TONE, agentPath, agentState, currentStage } from '../../../lib/derive';
import { C, KIND_TONE, Screenshot } from '../../../lib/ui';
import { StageIcon } from './stages';

const TONE_COLOR = { muted: C.muted2, green: C.green, yellow: C.yellow, blue: C.blue, red: C.red } as const;
const TONE_RGB = { muted: 'var(--pp-muted-rgb)', green: 'var(--pp-accent-rgb)', yellow: 'var(--pp-yellow-rgb)', blue: 'var(--pp-blue-rgb)', red: 'var(--pp-red-rgb)' } as const;
const OUTCOME: Record<NonNullable<SessionState['outcome']>, { text: string; ok: boolean }> = {
  completed: { text: 'Reached the goal', ok: true }, gave_up: { text: 'Gave up', ok: false },
  out_of_steps: { text: 'Out of patience', ok: false }, error: { text: 'Session crashed', ok: false },
};
const THUMB_H = 158;
const clamp = (lines: number): CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' });

function Dots({ value, label }: { value: number; label: string }) {
  return (
    <span className="ac-dots" title={`${label} ${value}/5`}>
      <span className="mono">{label}</span>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} data-on={i <= value} data-tone={value >= 4 ? 'good' : value >= 3 ? 'mid' : 'bad'} />)}
    </span>
  );
}

export default function AgentCard({ runId, s }: { runId: string; s: SessionState }) {
  const state = agentState(s);
  const tone = STATE_TONE[state];
  const color = TONE_COLOR[tone];
  const stage = currentStage(s);
  const last = s.steps[s.steps.length - 1];
  const thought = [...s.steps].reverse().find((st) => st.reasoning)?.reasoning;
  const obs = s.observations[s.observations.length - 1];
  const total = s.patience || 1;
  const used = Math.max(0, total - s.actions_left);
  const running = s.status === 'running';
  const pips = Math.min(total, 24);
  const usedPips = Math.round((used / total) * pips);
  const low = s.actions_left / total < 0.25;
  const outcome = s.outcome ? OUTCOME[s.outcome] : null;

  return (
    <Link to={agentPath(runId, s.session_id)} className="ac-card" data-state={state}
      style={{ '--ac-rgb': TONE_RGB[tone] } as CSSProperties}
      aria-label={`${s.persona}, variant ${s.variant.toUpperCase()}: ${STATE_LABEL[state]}, at ${stage}. Open this agent.`}>
      <style>{CSS}</style>

      {/* a mini browser showing what the agent sees */}
      <div className="ac-browser">
        <div className="ac-chrome">
          <span className="ac-lights"><i /><i /><i /></span>
          <span className="ac-url"><StageIcon stage={stage} color={color} size={12} /><span>{stage}</span></span>
          <span className="ac-variant mono">{s.variant.toUpperCase()}</span>
        </div>
        <div className="ac-shot">
          {last ? <Screenshot runId={runId} sessionId={s.session_id} idx={last.idx} device={s.device} maxHeight={THUMB_H} style={{ height: THUMB_H, alignItems: 'center', borderRadius: 0, border: 0 }} />
            : <div className="ac-wait"><span className="ac-spin" aria-hidden="true" />Starting its browser…</div>}
          <span className={`ac-state ${outcome ? (outcome.ok ? 'ok' : 'bad') : ''}`}>
             <span className="ac-state-dot" style={{ background: color, animation: running ? "pp-pulse 1.2s ease-in-out infinite" : undefined }} />
            {outcome ? outcome.text : STATE_LABEL[state]}
          </span>
        </div>
      </div>

      <div className="ac-body">
        <div><span className="ac-label">Current intent</span><div className="ac-thought" style={clamp(2)}>{thought ?? (state === 'starting' ? 'Waiting for its container and browser.' : 'Looking at the page.')}</div></div>

        <div>
          <div className="ac-pips" role="img" aria-label={`Patience: ${s.actions_left} of ${total} actions left`}>
            {Array.from({ length: pips }, (_, i) => <i key={i} data-used={i < usedPips} data-low={low} />)}
          </div>
          <div className="mono ac-meta"><span>{used} actions</span><span style={{ color: low ? C.red : C.muted }}>{s.actions_left} patience left</span></div>
        </div>

        {obs && (
          <div className="ac-obs" data-tone={KIND_TONE[obs.kind]}>
            <span className="mono ac-kind">{obs.kind} · {obs.severity}</span>
            <span style={clamp(2)}>{obs.text}</span>
          </div>
        )}

        {s.exit_survey && (
          <div className="ac-exit">
            <div className="ac-quote" style={clamp(3)}>{s.exit_survey.summary}</div>
            <div className="ac-scores">
              <Dots value={s.exit_survey.ease} label="ease" />
              <Dots value={s.exit_survey.trust} label="trust" />
              <span className={`ac-return ${s.exit_survey.would_return ? 'yes' : 'no'}`}>{s.exit_survey.would_return ? 'Would return' : 'Would not return'}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

const CSS = `
.ac-card { --ac-rgb: var(--pp-muted-rgb); display: flex; flex-direction: column; min-width: 0; border-radius: 10px; overflow: hidden; text-decoration: none; color: var(--pp-text);
  background: var(--pp-surface); border: 1px solid var(--pp-border); border-top: 2px solid rgba(var(--ac-rgb), 0.75);
  transition: box-shadow .15s, border-color .15s; }
.ac-card:hover { border-color: rgba(var(--ac-rgb), 0.6); box-shadow: 0 4px 14px var(--pp-shadow); }

.ac-browser { background: var(--pp-bg); border-bottom: 1px solid var(--pp-border); }
.ac-chrome { display: flex; align-items: center; gap: 8px; padding: 7px 9px; background: var(--pp-surface2); border-bottom: 1px solid var(--pp-border); }
.ac-lights { display: inline-flex; gap: 4px; }
.ac-lights i { width: 7px; height: 7px; border-radius: 50%; background: var(--pp-border2); }

.ac-url { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 6px; background: var(--pp-bg); border: 1px solid var(--pp-border); font-size: 11px; color: var(--pp-muted2); }
.ac-url span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ac-variant { font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px; background: var(--pp-surface); border: 1px solid var(--pp-border2); }
.ac-shot { position: relative; }
.ac-wait { height: ${THUMB_H}px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--pp-muted); font-size: 12px; }
.ac-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--pp-border2); border-top-color: var(--pp-accent); animation: ac-spin .8s linear infinite; }
@keyframes ac-spin { to { transform: rotate(360deg); } }
.ac-state { position: absolute; left: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 6px; font-size: 11px; font-weight: 600;
  background: var(--pp-glass); border: 1px solid rgba(var(--ac-rgb), 0.45); color: rgb(var(--ac-rgb)); }
.ac-state.ok { color: var(--pp-accent); border-color: rgba(var(--pp-accent-rgb),0.5); }
.ac-state.bad { color: var(--pp-red); border-color: rgba(var(--pp-red-rgb),0.5); }
.ac-state-dot { width: 6px; height: 6px; border-radius: 50%; }
.ac-body { display: flex; flex-direction: column; gap: 12px; padding: 12px 13px 13px; flex: 1; }
.ac-thought { font-size: 12.5px; line-height: 1.45; color: var(--pp-text); }
.ac-label { display: block; font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pp-muted); margin-bottom: 3px; }
.ac-pips { display: flex; gap: 2px; }
.ac-pips i { flex: 1; height: 5px; border-radius: 1px; background: var(--pp-accent); }
.ac-pips i[data-low="true"] { background: var(--pp-yellow); }
.ac-pips i[data-used="true"] { background: var(--pp-border); }
.ac-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; color: var(--pp-muted); margin-top: 6px; }
.ac-obs { display: flex; flex-direction: column; gap: 3px; font-size: 12px; line-height: 1.45; color: var(--pp-muted2); padding: 8px 10px; border-radius: 6px;
  background: rgba(var(--pp-blue-rgb),0.05); border-left: 2px solid var(--pp-blue); }
.ac-obs[data-tone="red"] { background: rgba(var(--pp-red-rgb),0.07); border-left-color: var(--pp-red); }
.ac-obs[data-tone="yellow"] { background: rgba(var(--pp-yellow-rgb),0.07); border-left-color: var(--pp-yellow); }
.ac-obs[data-tone="green"] { background: rgba(var(--pp-accent-rgb),0.07); border-left-color: var(--pp-accent); }
.ac-kind { font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pp-muted); }
.ac-exit { margin-top: auto; padding-top: 11px; border-top: 1px dashed var(--pp-border); display: flex; flex-direction: column; gap: 9px; }
.ac-quote { font-size: 12.5px; line-height: 1.5; color: var(--pp-text); }
.ac-quote { font-style: italic; color: var(--pp-muted2); }
.ac-scores { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.ac-dots { display: inline-flex; align-items: center; gap: 3px; }
.ac-dots .mono { font-size: 10px; color: var(--pp-muted); margin-right: 3px; text-transform: uppercase; letter-spacing: 0.08em; }
.ac-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--pp-border); }
.ac-dots i[data-on="true"][data-tone="good"] { background: var(--pp-accent); } .ac-dots i[data-on="true"][data-tone="mid"] { background: var(--pp-yellow); } .ac-dots i[data-on="true"][data-tone="bad"] { background: var(--pp-red); }
.ac-return { margin-left: auto; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 5px; }
.ac-return.yes { color: var(--pp-accent); background: rgba(var(--pp-accent-rgb),0.1); } .ac-return.no { color: var(--pp-red); background: rgba(var(--pp-red-rgb),0.1); }
`;
