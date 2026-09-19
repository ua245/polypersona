// Full-screen view of one agent: its screen as large as possible, what it did and why at each step,
// a scrubbable timeline, playback, and live follow. Uses the browser's Fullscreen API.
import { useCallback, useEffect, useRef, useState } from 'react';
import { shotUrl, type Observation, type SessionState, type Step } from '../../lib/api';
import { avatarColor, initials, stageOf } from '../../lib/derive';
import { C, KIND_TONE, stepLabel } from '../../lib/ui';

const PLAY_MS = 1400;

export default function Theater({ runId, session, steps, observations, pos, onSelect, follow, onFollow, onClose }: {
  runId: string; session: SessionState; steps: Step[]; observations: Observation[]; pos: number;
  onSelect: (pos: number) => void; follow: boolean; onFollow: (on: boolean) => void; onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState(true);
  const running = session.status === 'running';
  const last = steps.length - 1;
  const step = pos >= 0 ? steps[pos] : null;
  const next = pos >= 0 ? steps[pos + 1] : undefined;
  const here = step ? observations.filter((o) => o.step_idx === step.idx) : [];
  const used = Math.max(0, (session.patience || 0) - session.actions_left);

  // Enter real fullscreen on open; leaving it (Esc or the browser's own control) closes the view.
  useEffect(() => {
    const el = root.current;
    el?.requestFullscreen?.().catch(() => { /* not allowed: stays as a full-window overlay */ });
    const onChange = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const close = useCallback(() => { if (document.fullscreenElement) void document.exitFullscreen(); else onClose(); }, [onClose]);

  // Playback: advance one step at a time, stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (pos >= last) { setPlaying(false); return; }
    const t = setTimeout(() => onSelect(pos + 1), PLAY_MS);
    return () => clearTimeout(t);
  }, [playing, pos, last, onSelect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); onSelect(pos - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); onSelect(pos + 1); }
      else if (e.key === ' ') { e.preventDefault(); if (pos >= last) onSelect(0); setPlaying((p) => !p); }
      else if (e.key.toLowerCase() === 'i') setPanel((p) => !p);
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pos, last, onSelect, onClose]);

  const dot = next?.args.x != null && next?.args.y != null ? { x: next.args.x / 10, y: next.args.y / 10 } : null;

  return (
    <div ref={root} className="th-root" role="dialog" aria-modal="true" aria-label={`Full screen: ${session.persona}`}>
      <style>{CSS}</style>
      <header className="th-top">
        <span className="th-av" style={{ background: avatarColor(session.persona) }}>{initials(session.persona)}</span>
        <div className="th-who">
          <b>{session.persona}</b>
          <span>Variant {session.variant.toUpperCase()} · {session.device} · {session.savviness} savviness</span>
        </div>
        <div className="th-url mono" title={step?.url}>{step?.url || 'about:blank'}</div>
        {running && <span className="th-live" data-on={follow}><i />{follow ? 'LIVE' : 'PAUSED ON STEP'}</span>}
        <button type="button" className="th-btn" onClick={() => setPanel((p) => !p)} aria-pressed={panel} title="Toggle details (I)">Details</button>
        <button type="button" className="th-btn" onClick={close} title="Exit full screen (Esc)">Exit full screen</button>
      </header>

      <div className="th-main" data-panel={panel}>
        <div className="th-stage">
          {step ? (
            <div className="th-frame" data-mobile={session.device === 'mobile'}>
              <img src={shotUrl(runId, session.session_id, step.idx)} alt={`Screen after step ${step.idx}`} />
              {dot && <span className="th-dot" style={{ left: `${dot.x}%`, top: `${dot.y}%` }} title="Where the next click lands" />}
            </div>
          ) : <div className="th-empty">No screens recorded yet.</div>}
        </div>

        {panel && (
          <aside className="th-panel" aria-label="Step details">
            <div className="th-label">Step {step?.idx ?? 0} of {Math.max(0, last)} · {step ? stageOf(step.url) : '—'}</div>
            <div className="th-action mono">{step ? stepLabel(step) : 'Waiting for the first page'}</div>
            {step?.reasoning && (<><div className="th-label">Reasoning</div><p className="th-reason">{step.reasoning}</p></>)}
            {step && !step.changed && step.action === 'click' && <div className="th-flag">This click changed nothing on the page.</div>}
            {here.length > 0 && (
              <>
                <div className="th-label">Observations at this step</div>
                {here.map((o, i) => (
                  <div key={i} className="th-obs" data-tone={KIND_TONE[o.kind]}><span className="mono">{o.kind} · severity {o.severity}</span>{o.text}</div>
                ))}
              </>
            )}
            <div className="th-label">Patience</div>
            <div className="th-pat"><div style={{ width: `${session.patience ? (session.actions_left / session.patience) * 100 : 0}%` }} /></div>
            <div className="th-small mono">{used} used · {session.actions_left} of {session.patience} left</div>
            {session.outcome && (
              <>
                <div className="th-label">Outcome</div>
                <div className="th-outcome" data-ok={session.outcome === 'completed'}>
                  {session.outcome === 'completed' ? 'Reached the goal' : session.outcome === 'out_of_steps' ? 'Ran out of patience' : session.outcome === 'error' ? 'Session crashed' : 'Gave up'}
                </div>
                {session.exit_survey && <p className="th-reason" style={{ fontStyle: 'italic' }}>{session.exit_survey.summary}</p>}
              </>
            )}
            <div className="th-keys mono">← → step · Space play · I details · Esc exit</div>
          </aside>
        )}
      </div>

      <footer className="th-bar">
        <button type="button" className="th-btn" aria-label="Previous step" disabled={pos <= 0} onClick={() => { setPlaying(false); onSelect(pos - 1); }}>←</button>
        <button type="button" className="th-btn th-play" onClick={() => { if (pos >= last) onSelect(0); setPlaying((p) => !p); }} disabled={last < 1}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" className="th-btn" aria-label="Next step" disabled={pos >= last} onClick={() => { setPlaying(false); onSelect(pos + 1); }}>→</button>
        <input className="th-scrub" type="range" min={0} max={Math.max(0, last)} value={Math.max(0, pos)} aria-label="Step"
          onChange={(e) => { setPlaying(false); onSelect(Number(e.target.value)); }}
          style={{ '--th-p': `${last > 0 ? (Math.max(0, pos) / last) * 100 : 0}%` } as React.CSSProperties} />
        <span className="mono th-count">{Math.max(0, pos)} / {Math.max(0, last)}</span>
        {running && <button type="button" className="th-btn" aria-pressed={follow} onClick={() => onFollow(!follow)} style={follow ? { color: C.green, borderColor: C.green } : undefined}>Follow live</button>}
      </footer>
    </div>
  );
}

const CSS = `
.th-root { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: #07080b; color: #e8eaf0; }
.th-top { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #1e2230; background: #0d0f14; }
.th-av { width: 30px; height: 30px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.th-who { display: flex; flex-direction: column; min-width: 0; }
.th-who b { font-size: 14px; font-weight: 600; }
.th-who span { font-size: 11.5px; color: #9ca3af; }
.th-url { flex: 1; min-width: 0; font-size: 12px; color: #9ca3af; background: #07080b; border: 1px solid #1e2230; border-radius: 6px; padding: 6px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-live { display: inline-flex; align-items: center; gap: 6px; font: 600 11px 'JetBrains Mono', monospace; letter-spacing: 0.08em; color: #facc15; }
.th-live i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.th-live[data-on="true"] { color: var(--pp-accent); } .th-live[data-on="true"] i { animation: pp-pulse 1.2s ease-in-out infinite; }
.th-btn { font: 500 12.5px 'Inter', sans-serif; color: #e8eaf0; background: #151821; border: 1px solid #252a38; border-radius: 6px; padding: 6px 12px; cursor: pointer; white-space: nowrap; }
.th-btn:hover:not(:disabled) { border-color: #3b4252; }
.th-btn[aria-pressed="true"] { background: #1e2230; }
.th-btn:disabled { opacity: 0.4; cursor: default; }
.th-play { min-width: 72px; background: var(--pp-accent); color: var(--pp-on-accent); border-color: transparent; font-weight: 600; }
.th-main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 360px; }
.th-main[data-panel="false"] { grid-template-columns: minmax(0, 1fr); }
.th-stage { min-height: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: #000; }
.th-frame { position: relative; line-height: 0; max-height: 100%; max-width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.6); border-radius: 6px; overflow: hidden; }
.th-frame img { display: block; max-width: 100%; max-height: calc(100vh - 150px); object-fit: contain; }
.th-frame[data-mobile="true"] img { max-width: 420px; }
.th-dot { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2px solid var(--pp-accent); background: rgba(var(--pp-accent-rgb),0.3); pointer-events: none; }
.th-empty { color: #6b7280; font-size: 14px; }
.th-panel { min-height: 0; overflow-y: auto; padding: 18px 18px 24px; border-left: 1px solid #1e2230; background: #0d0f14; display: flex; flex-direction: column; gap: 8px; }
.th-panel > * { flex-shrink: 0; }
.th-label { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; margin-top: 10px; }
.th-label:first-child { margin-top: 0; }
.th-action { font-size: 13px; color: #e8eaf0; line-height: 1.5; overflow-wrap: anywhere; }
.th-reason { margin: 0; font-size: 14px; line-height: 1.6; color: #e8eaf0; }
.th-flag { font-size: 12px; color: #f87171; padding: 6px 10px; border-radius: 6px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); }
.th-obs { font-size: 13px; line-height: 1.5; padding: 8px 10px; border-radius: 6px; background: rgba(96,165,250,0.06); border-left: 2px solid #60a5fa; display: flex; flex-direction: column; gap: 3px; }
.th-obs[data-tone="red"] { background: rgba(248,113,113,0.07); border-left-color: #f87171; }
.th-obs[data-tone="yellow"] { background: rgba(250,204,21,0.06); border-left-color: #facc15; }
.th-obs[data-tone="green"] { background: rgba(74,222,128,0.06); border-left-color: #4ade80; }
.th-obs .mono { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; }
.th-pat { height: 5px; border-radius: 3px; background: #1e2230; overflow: hidden; }
.th-pat > div { height: 100%; background: var(--pp-accent); }
.th-small { font-size: 11px; color: #9ca3af; }
.th-outcome { font-size: 14px; font-weight: 600; color: #f87171; }
.th-outcome[data-ok="true"] { color: #4ade80; }
.th-keys { margin-top: auto; padding-top: 16px; font-size: 10.5px; color: #6b7280; }
.th-bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid #1e2230; background: #0d0f14; }
.th-scrub { flex: 1; -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; cursor: pointer;
  background: linear-gradient(90deg, var(--pp-accent) var(--th-p), #252a38 var(--th-p)); }
.th-scrub::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--pp-accent); }
.th-scrub::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 2px solid var(--pp-accent); }
.th-count { font-size: 12px; color: #9ca3af; min-width: 56px; text-align: right; }
@media (max-width: 900px) { .th-main { grid-template-columns: minmax(0, 1fr); } .th-panel { display: none; } .th-url { display: none; } }
`;
