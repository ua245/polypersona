// The Crowd: every agent as a person walking through the site's journey, one lane each, grouped by
// variant. Each action leaves a footprint (green: the page changed, red: a click that did nothing,
// amber: a complaint), stages glow red where people struggle, and what they said pops up as they say it.
// Live mode follows the run as it happens; replay mode plays a finished run back, time-compressed.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Observation, SessionState, Step } from '../lib/api';
import { agentPath, agentState, avatarColor, initials, stageOf } from '../lib/derive';
import { C } from '../lib/ui';
import { StageIcon, orderedStages } from '../pages/test/live/stages';

type Mark = 'ok' | 'dead' | 'idle' | 'complaint' | 'delight';
const MARK_COLOR: Record<Mark, string> = { ok: C.green, dead: C.red, idle: 'var(--pp-border2)', complaint: C.yellow, delight: 'var(--pp-delight)' };
const NEGATIVE = new Set<Observation['kind']>(['bug', 'friction', 'confusion']);

interface Footprint { step: Step; stage: string; k: number; mark: Mark; obs: Observation[] }
interface Lane { s: SessionState; prints: Footprint[] }

const W = 1000;
const LABEL_W = 150;
const OUT_W = 112;
const HEAD_H = 58;
const GROUP_H = 28;
const LANE_H_ROOMY = 40;
const DOT = 9;

/** Journey stages from page URLs; a site whose URL never changes gets action ranges instead. */
export function crowdStages(sessions: SessionState[]): { stages: string[]; stageFor: (s: SessionState, step: Step) => string } {
  const byUrl = orderedStages(sessions);
  if (byUrl.length >= 2) return { stages: byUrl, stageFor: (_s, step) => stageOf(step.url) };
  const most = Math.max(4, ...sessions.map((s) => s.steps.length));
  const size = Math.ceil(most / 5);
  const buckets = Array.from({ length: Math.ceil(most / size) }, (_, i) => `Actions ${i * size + 1}–${(i + 1) * size}`);
  return { stages: buckets, stageFor: (_s, step) => buckets[Math.min(buckets.length - 1, Math.floor(Math.max(0, step.idx - 1) / size))]! };
}

function laneOf(s: SessionState, stageFor: (s: SessionState, step: Step) => string): Lane {
  const obsAt = new Map<number, Observation[]>();
  for (const o of s.observations) obsAt.set(o.step_idx, [...(obsAt.get(o.step_idx) ?? []), o]);
  const perStage = new Map<string, number>();
  const prints = s.steps.map((step) => {
    const stage = stageFor(s, step);
    const k = perStage.get(stage) ?? 0;
    perStage.set(stage, k + 1);
    const obs = obsAt.get(step.idx) ?? [];
    const mark: Mark = obs.some((o) => NEGATIVE.has(o.kind) && o.severity >= 3) ? 'complaint'
      : obs.some((o) => o.kind === 'delight') ? 'delight'
      : step.action === 'click' && !step.changed ? 'dead'
      : step.changed ? 'ok' : 'idle';
    return { step, stage, k, mark, obs };
  });
  return { s, prints };
}

/** Plays [t0, t1] back over `seconds`, holds, and loops. Returns the virtual time, or null when not replaying. */
function useReplay(t0: number, t1: number, enabled: boolean, seconds = 18) {
  const [now, setNow] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!enabled || reduced || !(t1 > t0)) { setNow(null); return; }
    let raf = 0;
    const start = performance.now();
    const hold = 4;
    const frame = (t: number) => {
      const el = (t - start) / 1000;
      const p = Math.min(1, el / seconds);
      setNow(t0 + p * (t1 - t0));
      if (el > seconds + hold) { setCycle((c) => c + 1); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t0, t1, enabled, reduced, seconds, cycle]);
  return { now, restart: () => setCycle((c) => c + 1), speed: t1 > t0 ? Math.round((t1 - t0) / seconds) : 1 };
}

export interface CrowdProps {
  sessions: SessionState[];
  runId?: string;
  mode: 'live' | 'final' | 'replay';
  variantLabel?: (v: string) => string;
  caption?: string;
}

export default function Crowd({ sessions, runId, mode, variantLabel = (v) => `Variant ${v.toUpperCase()}`, caption }: CrowdProps) {
  const navigate = useNavigate();
  const { stages, stageFor } = useMemo(() => crowdStages(sessions), [sessions]);
  const variants = useMemo(() => [...new Set(sessions.map((s) => s.variant))].sort(), [sessions]);
  const lanes = useMemo(() => sessions.slice().sort((a, b) => a.variant.localeCompare(b.variant) || a.persona.localeCompare(b.persona)).map((s) => laneOf(s, stageFor)), [sessions, stageFor]);

  const allTs = sessions.flatMap((s) => s.steps.map((st) => st.ts));
  const t0 = allTs.length ? Math.min(...allTs) : 0;
  const t1 = allTs.length ? Math.max(...allTs) : 0;
  const [replaying, setReplaying] = useState(mode === 'replay');
  useEffect(() => setReplaying(mode === 'replay'), [mode]);
  const replay = useReplay(t0, t1, replaying);
  const byActions = stages[0]?.startsWith('Actions') ?? false;
  const T = replay.now ?? Number.POSITIVE_INFINITY;
  const [hover, setHover] = useState<{ lane: Lane; print: Footprint | null } | null>(null);

  // Real clock for live speech bubbles.
  const [wall, setWall] = useState(() => Date.now() / 1000);
  useEffect(() => { if (mode !== 'live') return; const id = setInterval(() => setWall(Date.now() / 1000), 1000); return () => clearInterval(id); }, [mode]);

  // ---------- geometry ----------
  const LANE_H = sessions.length > 12 ? 32 : LANE_H_ROOMY;
  const n = Math.max(stages.length, 1);
  const colW = (W - LABEL_W - OUT_W) / n;
  const perRow = Math.max(3, Math.floor((colW - 46) / DOT));
  const colX = (stage: string) => LABEL_W + Math.max(0, stages.indexOf(stage)) * colW;
  const laneY = new Map<string, number>();
  const groupY: { v: string; y: number }[] = [];
  let y = HEAD_H;
  for (const v of variants) {
    groupY.push({ v, y });
    y += GROUP_H;
    for (const l of lanes.filter((l) => l.s.variant === v)) { laneY.set(l.s.session_id, y); y += LANE_H; }
    y += 8;
  }
  const H = y + 6;
  const printXY = (p: Footprint, ly: number) => ({ x: colX(p.stage) + 12 + (p.k % perRow) * DOT, y: ly + 12 + Math.floor(p.k / perRow) * DOT });

  // ---------- what is visible at time T ----------
  const view = lanes.map((l) => {
    const seen = l.prints.filter((p) => p.step.ts <= T);
    const last = seen[seen.length - 1];
    const finished = l.s.outcome != null && (T === Number.POSITIVE_INFINITY || T >= t1 || (last != null && last === l.prints[l.prints.length - 1] && T >= last.step.ts + 2));
    const state = finished ? agentState(l.s) : seen.length === 0 ? 'starting' : last && !last.step.changed ? 'hesitating' : 'active';
    return { l, seen, last, finished, state };
  });
  const inStage = new Map<string, number>();
  const heat = new Map<string, number>();
  for (const v of view) {
    if (v.last && !v.finished) inStage.set(v.last.stage, (inStage.get(v.last.stage) ?? 0) + 1);
    for (const p of v.seen) if (p.mark === 'dead' || p.mark === 'complaint') heat.set(p.stage, (heat.get(p.stage) ?? 0) + (p.mark === 'complaint' ? 2 : 1));
  }
  const converted = view.filter((v) => v.finished && v.l.s.outcome === 'completed').length;
  const gaveUp = view.filter((v) => v.finished && v.l.s.outcome !== 'completed').length;
  const browsing = view.length - converted - gaveUp;

  // Speech bubbles: the newest complaints or delights, while they are fresh.
  const bubbleWindow = replay.now != null ? Math.max(4, (t1 - t0) / 18) * 2.4 : 14;
  const clock = replay.now ?? wall;
  const bubbles = view
    .flatMap((v) => v.seen.filter((p) => p.obs.length && clock - p.step.ts < bubbleWindow).map((p) => ({ v, p, o: p.obs[p.obs.length - 1]! })))
    .sort((a, b) => b.p.step.ts - a.p.step.ts)
    .slice(0, 2);

  const open = (s: SessionState, step?: number) => { if (runId) navigate(agentPath(runId, s.session_id, step)); };
  const progress = replay.now != null && t1 > t0 ? (replay.now - t0) / (t1 - t0) : 1;
  const heads = view.map((v) => {
    const ly = laneY.get(v.l.s.session_id)!;
    const x = v.last ? colX(v.last.stage) + colW - 18 : LABEL_W + 10;
    return { ...v, ly, x, y: ly + LANE_H / 2 - 2 };
  });

  return (
    <div className="crowd">
      <div className="crowd-top">
        <div className="crowd-stats">
          <Stat n={browsing} label="on the site" color={C.text} />
          <Stat n={converted} label="converted" color={C.green} />
          <Stat n={gaveUp} label="gave up" color={C.red} />
        </div>
        <div className="crowd-caption mono">
          {replay.now != null ? (
            <>
              <span className="crowd-rec" aria-hidden="true" />REPLAY · {replay.speed}× · {caption ?? 'a real test'}
              <button type="button" className="crowd-restart" onClick={replay.restart} aria-label="Restart replay">↺</button>
              {mode === 'final' && <button type="button" className="crowd-restart" onClick={() => setReplaying(false)} aria-label="Stop replay">■</button>}
            </>
          ) : mode === 'live' ? <><span className="dot-green" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} /> LIVE · {caption ?? 'following every agent'}</>
            : <>{caption}{mode === 'final' && t1 > t0 && <button type="button" className="crowd-play" onClick={() => setReplaying(true)}>▶ Replay the test</button>}</>}
        </div>
      </div>
      {replay.now != null && <div className="crowd-progress" aria-hidden="true"><div style={{ width: `${progress * 100}%` }} /></div>}

      <div className="crowd-scroll">
        <div className="crowd-canvas" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sessions.length} agents moving through ${stages.join(', ')}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
            <defs>
              <filter id="crowd-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <linearGradient id="crowd-heat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.red} stopOpacity="0.9" /><stop offset="1" stopColor={C.red} stopOpacity="0" /></linearGradient>
            </defs>

            {/* stage columns: faint stripes, red heat where people struggle */}
            {stages.map((st, i) => {
              const x = LABEL_W + i * colW;
              const h = heat.get(st) ?? 0;
              const count = inStage.get(st) ?? 0;
              return (
                <g key={st}>
                  <rect x={x} y={HEAD_H - 6} width={colW} height={H - HEAD_H} fill={i % 2 ? 'var(--pp-stripe-1)' : 'var(--pp-stripe-2)'} />
                  <rect x={x} y={HEAD_H - 6} width={colW} height={H - HEAD_H} fill="url(#crowd-heat)" style={{ opacity: `calc(var(--pp-heat) * ${Math.min(0.24, h * 0.02)})`, transition: 'opacity .6s' }} />
                  <line x1={x} x2={x} y1={10} y2={H} stroke={C.border} strokeWidth={1} />
                  <g transform={`translate(${x + 10}, 12)`}><StageIcon stage={st} color={h >= 4 ? C.red : C.muted2} size={16} /></g>
                  <text x={x + 32} y={24} fontSize={11.5} fill={C.text} fontWeight={600}>{st.length > Math.floor(colW / 8) ? `${st.slice(0, Math.floor(colW / 8) - 1)}…` : st}</text>
                  <text x={x + 10} y={44} fontSize={10} fill={count ? C.green : C.muted} className="mono">{count ? `${count} here` : '·'}</text>
                </g>
              );
            })}
            <line x1={W - OUT_W} x2={W - OUT_W} y1={10} y2={H} stroke={C.border} strokeWidth={1} />
            <text x={W - OUT_W + 14} y={24} fontSize={11.5} fill={C.text} fontWeight={600}>Outcome</text>

            {/* variant groups */}
            {groupY.map(({ v, y: gy }) => (
              <g key={v}>
                <text x={12} y={gy + 18} fontSize={10.5} fill={C.muted2} className="mono" letterSpacing="0.08em">{variantLabel(v).toUpperCase().slice(0, 40)}</text>
                <line x1={LABEL_W} x2={W - 8} y1={gy + 14} y2={gy + 14} stroke={C.border2} strokeDasharray="2 4" />
              </g>
            ))}

            {/* footprints */}
            {heads.map(({ l, seen, ly }) => (
              <g key={l.s.session_id}>
                <text x={14} y={ly + 18} fontSize={12} fill={C.text} fontWeight={500}>{l.s.persona.split(' ')[0]}{l.s.repeat > 0 ? <tspan fill={C.muted}> #{l.s.repeat + 1}</tspan> : null}</text>
                <text x={14} y={ly + (LANE_H < 40 ? 28 : 31)} fontSize={9.5} fill={C.muted}>{l.s.device} · {l.s.savviness}</text>
                {seen.map((p) => {
                  if (p.k >= perRow * 3) return null;
                  const { x, y: py } = printXY(p, ly);
                  const big = p.mark === 'complaint' || p.mark === 'delight';
                  return (
                    <circle key={p.step.idx} cx={x} cy={py} r={big ? 3.6 : 2.8} fill={MARK_COLOR[p.mark]} opacity={p.mark === 'idle' ? 0.9 : 0.95}
                      className="crowd-print" style={{ cursor: runId ? 'pointer' : 'default' }}
                      onMouseEnter={() => setHover({ lane: l, print: p })} onClick={() => open(l.s, p.step.idx)} />
                  );
                })}
              </g>
            ))}

            {/* people */}
            {heads.map(({ l, finished, state, x, y: hy, last }) => {
              const ring = state === 'hesitating' ? C.yellow : finished ? (l.s.outcome === 'completed' ? C.green : C.red) : state === 'starting' ? C.muted : C.green;
              return (
                <g key={l.s.session_id} className="crowd-head" style={{ transform: `translate(${x}px, ${hy}px)`, cursor: runId ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHover({ lane: l, print: last ?? null })} onClick={() => open(l.s, last?.step.idx)}>
                  {!finished && state !== 'starting' && <circle r={13} fill="none" stroke={ring} strokeWidth={1.5} className="crowd-pulse" />}
                  <circle r={11} fill={avatarColor(l.s.persona)} stroke={ring} strokeWidth={2} opacity={finished && l.s.outcome !== 'completed' ? 0.55 : 1} />
                  <text textAnchor="middle" dy={3.5} fontSize={8.5} fontWeight={700} fill="#fff">{initials(l.s.persona)}</text>
                </g>
              );
            })}

            {/* outcomes */}
            {heads.map(({ l, finished, ly, last }) => {
              if (!finished) return null;
              const ok = l.s.outcome === 'completed';
              const cx = W - OUT_W + 24;
              const cy = ly + LANE_H / 2 - 2;
              return (
                <g key={l.s.session_id} className="crowd-outcome">
                  {ok && <circle cx={cx} cy={cy} r={16} fill={C.green} opacity={0.18} className="crowd-burst" />}
                  <circle cx={cx} cy={cy} r={10} fill={ok ? C.green : 'transparent'} stroke={ok ? C.green : C.red} strokeWidth={1.8} />
                  {ok ? <path d={`M${cx - 4.5} ${cy}l3 3 6-6.5`} stroke={C.bg} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    : <path d={`M${cx - 4} ${cy - 4}l8 8M${cx + 4} ${cy - 4}l-8 8`} stroke={C.red} strokeWidth={2} strokeLinecap="round" />}
                  <text x={cx + 17} y={cy - 1} fontSize={10.5} fill={ok ? C.green : C.red} fontWeight={600}>{ok ? 'converted' : l.s.outcome === 'out_of_steps' ? 'lost patience' : 'gave up'}</text>
                  {!ok && last && <text x={cx + 17} y={cy + 11} fontSize={9} fill={C.muted}>{byActions ? `after ${l.prints.length - 1} actions` : `at ${last.stage.slice(0, 12)}`}</text>}
                </g>
              );
            })}
          </svg>

          {/* speech bubbles */}
          {!hover && bubbles.map(({ v, p, o }) => {
            const h = heads.find((x) => x.l === v.l)!;
            return (
              <div key={`${v.l.s.session_id}-${p.step.idx}`} className={`crowd-bubble ${h.x > W * 0.62 ? 'left' : ''} ${NEGATIVE.has(o.kind) ? 'neg' : o.kind === 'delight' ? 'pos' : ''}`}
                style={{ left: `${(h.x / W) * 100}%`, top: `${(h.y / H) * 100}%` }}>
                <b>{v.l.s.persona.split(' ')[0]}</b> {o.text.length > 96 ? `${o.text.slice(0, 95)}…` : o.text}
              </div>
            );
          })}

          {/* hover card */}
          {hover && (() => {
            const ly = laneY.get(hover.lane.s.session_id)!;
            const pos = hover.print ? printXY(hover.print, ly) : { x: LABEL_W, y: ly };
            const s = hover.lane.s;
            const st = hover.print?.step;
            const left = (pos.x / W) * 100;
            return (
              <div className="crowd-card" style={{ left: `${Math.min(left, 72)}%`, top: `${((pos.y + 14) / H) * 100}%` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="crowd-av" style={{ background: avatarColor(s.persona) }}>{initials(s.persona)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.persona}</div>
                    <div style={{ fontSize: 11, color: C.muted2 }}>{s.device} · {s.savviness} savviness · {variantLabel(s.variant)}</div>
                  </div>
                </div>
                {st && <div className="mono" style={{ fontSize: 10.5, color: C.muted, marginTop: 10 }}>STEP {st.idx} · {hover.print!.stage.toUpperCase()}{st.note ? ` · ${st.note}` : ''}</div>}
                {st?.reasoning && <div style={{ fontSize: 12.5, marginTop: 4, color: C.text }}>“{st.reasoning}”</div>}
                {hover.print?.obs.map((o, i) => (
                  <div key={i} className={`crowd-obs ${NEGATIVE.has(o.kind) ? 'neg' : o.kind === 'delight' ? 'pos' : ''}`}><span className="mono">{o.kind} {o.severity}</span>{o.text}</div>
                ))}
                {runId && <div style={{ fontSize: 11, color: C.green, marginTop: 8 }}>Click to open this moment →</div>}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="crowd-legend mono">
        <Key color={C.green}>page changed</Key><Key color={C.red}>click did nothing</Key><Key color={C.yellow}>complaint</Key><Key color="var(--pp-delight)">delight</Key>
        <span style={{ marginLeft: 'auto' }}>hover anyone to hear them</span>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return <div className="crowd-stat"><span className="mono" style={{ color }}>{n}</span><span>{label}</span></div>;
}

function Key({ color, children }: { color: string; children: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{children}</span>;
}

const CSS = `
.crowd { position: relative; border-radius: 12px; padding: 18px 18px 14px; background:
  var(--pp-surface);
  border: 1px solid var(--pp-border); }
.crowd-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 20px; margin-bottom: 10px; }
.crowd-stats { display: flex; gap: 22px; }
.crowd-stat { display: flex; align-items: baseline; gap: 7px; font-size: 12px; color: var(--pp-muted); }
.crowd-stat .mono { font-size: 26px; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; }
.crowd-caption { font-size: 10.5px; letter-spacing: 0.1em; color: var(--pp-muted2); display: inline-flex; align-items: center; gap: 8px; }
.crowd-rec { width: 7px; height: 7px; border-radius: 50%; background: var(--pp-red); box-shadow: 0 0 10px var(--pp-red); animation: pp-pulse 1.2s ease-in-out infinite; }
.crowd-restart { background: none; border: 1px solid var(--pp-border2); color: var(--pp-muted2); border-radius: 5px; width: 22px; height: 22px; cursor: pointer; font-size: 12px; line-height: 1; }
.crowd-play { margin-left: 10px; background: rgba(var(--pp-accent-rgb),0.1); border: 1px solid rgba(var(--pp-accent-rgb),0.35); color: var(--pp-accent); border-radius: 6px; padding: 4px 10px; font: 600 11px 'Inter', sans-serif; letter-spacing: 0; cursor: pointer; }
.crowd-play:hover { background: rgba(var(--pp-accent-rgb),0.18); }
.crowd-restart:hover { color: var(--pp-text); border-color: var(--pp-accent); }
.crowd-progress { height: 2px; background: var(--pp-border); border-radius: 2px; overflow: hidden; margin-bottom: 8px; }
.crowd-progress > div { height: 100%; background: var(--pp-accent); }
.crowd-scroll { overflow-x: auto; }
.crowd-canvas { position: relative; min-width: 680px; }
.crowd-head { transition: transform 0.7s cubic-bezier(.2,.8,.2,1); }
.crowd-head:hover circle:not(.crowd-pulse) { stroke-width: 3; }
.crowd-pulse { animation: crowd-pulse 1.8s ease-out infinite; transform-origin: 0 0; }
@keyframes crowd-pulse { from { transform: scale(0.85); opacity: 0.9; } to { transform: scale(1.7); opacity: 0; } }
.crowd-print { animation: crowd-pop .35s ease-out both; transform-box: fill-box; transform-origin: center; }
.crowd-print:hover { stroke: #fff; stroke-width: 1.2; }
@keyframes crowd-pop { from { transform: scale(0); } to { transform: scale(1); } }
.crowd-outcome { animation: crowd-fade .5s ease-out both; }
.crowd-burst { animation: crowd-burst 1.4s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes crowd-burst { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(2.2); opacity: 0; } }
@keyframes crowd-fade { from { opacity: 0; } to { opacity: 1; } }
.crowd-bubble { position: absolute; transform: translate(-50%, calc(-100% - 18px)); max-width: 260px; padding: 7px 10px; border-radius: 10px;
  background: var(--pp-glass); border: 1px solid var(--pp-border2); font-size: 11.5px; line-height: 1.4; color: var(--pp-text); pointer-events: none;
  box-shadow: 0 10px 30px var(--pp-shadow); animation: crowd-rise .35s ease-out both; backdrop-filter: blur(6px); }
.crowd-bubble::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 8px; height: 8px; background: inherit; border-right: 1px solid var(--pp-border2); border-bottom: 1px solid var(--pp-border2); transform: translateX(-50%) rotate(45deg); }
.crowd-bubble.left { transform: translate(calc(-100% - 20px), -50%); animation-name: crowd-rise-left; }
.crowd-bubble.left::after { left: auto; right: -5px; top: 50%; bottom: auto; transform: translateY(-50%) rotate(-45deg); }
@keyframes crowd-rise-left { from { opacity: 0; transform: translate(calc(-100% - 10px), -50%); } to { opacity: 1; transform: translate(calc(-100% - 20px), -50%); } }
.crowd-bubble.neg { border-color: rgba(var(--pp-yellow-rgb),0.45); } .crowd-bubble.pos { border-color: rgba(163,230,53,0.45); }
.crowd-bubble b { color: var(--pp-muted2); font-weight: 600; margin-right: 4px; }
@keyframes crowd-rise { from { opacity: 0; transform: translate(-50%, calc(-100% - 8px)); } to { opacity: 1; transform: translate(-50%, calc(-100% - 18px)); } }
.crowd-card { position: absolute; z-index: 3; width: 300px; padding: 12px 14px; border-radius: 12px; background: var(--pp-glass);
  border: 1px solid var(--pp-border2); box-shadow: 0 18px 50px var(--pp-shadow); pointer-events: none; animation: crowd-fade .15s ease-out both; }
.crowd-av { width: 28px; height: 28px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.crowd-obs { margin-top: 8px; padding: 7px 9px; border-radius: 8px; background: var(--pp-surface2); font-size: 12px; line-height: 1.45; border-left: 2px solid var(--pp-blue); }
.crowd-obs.neg { border-left-color: var(--pp-yellow); } .crowd-obs.pos { border-left-color: var(--pp-delight); }
.crowd-obs .mono { display: block; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pp-muted); margin-bottom: 2px; }
.crowd-legend { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 10.5px; color: var(--pp-muted); margin-top: 10px; }
`;
