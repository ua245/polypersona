import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ApiError, fmtTokens, guideAgent, sessionList, stopAgent, useRun, useSelectedRunId, videoUrl, type ExitSurvey, type Observation, type SessionState, type Step } from '../lib/api';
import { STATE_LABEL, STATE_TONE, agentPath, agentState, avatarColor, initials, stageOf, testPath } from '../lib/derive';
import { C, Empty, KIND_TONE, KindTag, Page, PatienceBar, Screenshot, SectionLabel, SessionTag, Tag, stepLabel, useTokenGate } from '../lib/ui';
import { orderedStages, stageVisits } from './test/live/stages';

const TONE_COLOR = { muted: C.muted2, green: C.green, yellow: C.yellow, blue: C.blue, red: C.red } as const;
const OUTCOME_EVENT = { completed: 'Reached the goal', gave_up: 'Gave up on the task', out_of_steps: 'Ran out of patience', error: 'The session crashed' } as const;

/** One line in the live inspector: a browser action, something the persona noted, or how the session ended. */
interface LogEvent { key: string; ts: number; stepIdx: number; color: string; text: string; tag?: string }

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M6.6 10.2l2.3 2.3 4.5-4.9" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The shared step label, with its dash swapped for a separator (no dashes in user-facing copy). */
const actionLabel = (s: Step): string => stepLabel(s).replace(' — ', ' · ');

const isDeadClick = (s: Step) => s.action === 'click' && !s.changed;

const shortAction = (s: Step): string => {
  switch (s.action) {
    case 'open': return 'open';
    case 'click': return 'click';
    case 'type_text': return 'type';
    case 'scroll': return `scroll ${s.args.direction ?? ''}`.trim();
    case 'press_key': return `key ${s.args.key ?? ''}`.trim();
    case 'go_back': return 'back';
    default: return s.action;
  }
};

const fmtOffset = (seconds: number): string => {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const parseHashStep = (hash: string): number | null => {
  const m = /^#step-(\d+)$/.exec(hash);
  return m ? Number(m[1]) : null;
};

function Card({ label, children, labelledBy }: { label: string; children: ReactNode; labelledBy: string }) {
  return (
    <section className="card" aria-labelledby={labelledBy} style={{ padding: 16, minWidth: 0 }}>
      <div id={labelledBy}><SectionLabel>{label}</SectionLabel></div>
      {children}
    </section>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '4px 0' }}>
      <span style={{ color: C.muted }}>{k}</span>
      <span className="mono" style={{ color: C.text, textAlign: 'right', overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote style={{ margin: 0, padding: '2px 0 2px 12px', borderLeft: `2px solid ${C.green}`, fontSize: 13, lineHeight: 1.55, color: C.text }}>
      {children}
    </blockquote>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, color: value <= 2 ? C.red : value === 3 ? C.yellow : C.green }}>
        {value}<span style={{ color: C.muted, fontSize: 12 }}>/5</span>
      </div>
    </div>
  );
}

function SurveyCard({ survey, session }: { survey: ExitSurvey; session: SessionState }) {
  const actuallyCompleted = session.outcome === 'completed';
  const mismatch = session.outcome != null && survey.believes_completed !== actuallyCompleted;
  return (
    <Card label="Exit survey" labelledBy="ad-survey">
      <Quote>{survey.summary}</Quote>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0 8px' }}>
        <Score label="Ease" value={survey.ease} />
        <Score label="Trust" value={survey.trust} />
      </div>
      <Row k="Would return">{survey.would_return ? 'yes' : 'no'}</Row>
      <Row k="Believes they completed it">{survey.believes_completed ? 'yes' : 'no'}</Row>
      <Row k="Verified outcome"><SessionTag s={session} /></Row>
      {mismatch && (
        <div role="note" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.5, color: C.red, background: 'rgba(var(--pp-red-rgb),0.08)', border: '1px solid rgba(var(--pp-red-rgb),0.25)' }}>
          {survey.believes_completed
            ? 'Mismatch: this person thinks they finished, but the task was never verified as complete. They would leave believing it worked.'
            : 'Mismatch: the task was verified as complete, but this person does not believe they finished. The confirmation was not clear to them.'}
        </div>
      )}
      {survey.biggest_problem && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Biggest problem</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C.muted2 }}>{survey.biggest_problem}</div>
        </div>
      )}
    </Card>
  );
}

export default function AgentDetail() {
  const { id = '', runId: routeRunId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const fallbackRunId = useSelectedRunId();
  const runId = routeRunId ?? params.get('run') ?? fallbackRunId;
  const { run, error } = useRun(runId);
  const session: SessionState | null = run?.sessions?.[id] ?? null;

  const steps = useMemo<Step[]>(() => session?.steps ?? [], [session]);
  const observations = useMemo<Observation[]>(() => session?.observations ?? [], [session]);
  const running = session?.status === 'running';

  const [follow, setFollow] = useState<boolean>(() => parseHashStep(window.location.hash) == null);
  const [pinnedIdx, setPinnedIdx] = useState<number>(() => parseHashStep(window.location.hash) ?? 0);

  // Deep links such as #step-14 (also when the hash changes while this page is open).
  useEffect(() => {
    const n = parseHashStep(location.hash);
    if (n != null) { setPinnedIdx(n); setFollow(false); }
  }, [location.hash, id]);

  const lastPos = steps.length - 1;
  const pinnedPos = useMemo(() => {
    if (!steps.length) return -1;
    const at = steps.findIndex((s) => s.idx === pinnedIdx);
    return at >= 0 ? at : Math.min(Math.max(pinnedIdx, 0), steps.length - 1);
  }, [steps, pinnedIdx]);
  const pos = follow ? lastPos : pinnedPos;
  const step: Step | null = pos >= 0 ? steps[pos] : null;
  const nextStep: Step | undefined = pos >= 0 ? steps[pos + 1] : undefined;

  const selectPos = useCallback((p: number) => {
    if (!steps.length) return;
    const clamped = Math.min(Math.max(p, 0), steps.length - 1);
    setPinnedIdx(steps[clamped].idx);
    setFollow(false);
  }, [steps]);
  const selectIdx = useCallback((idx: number) => {
    setPinnedIdx(idx);
    setFollow(false);
    viewerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const viewerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  // Keep the selected chip visible by scrolling only the strip, never the page.
  useEffect(() => {
    const strip = stripRef.current; const chip = chipRef.current;
    if (!strip || !chip) return;
    strip.scrollLeft = chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2;
  }, [pos, steps.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'VIDEO') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); selectPos(pos - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); selectPos(pos + 1); }
  };

  const obsByStep = useMemo(() => {
    const m = new Map<number, number>();
    observations.forEach((o) => m.set(o.step_idx, (m.get(o.step_idx) ?? 0) + 1));
    return m;
  }, [observations]);
  const obsNewestFirst = useMemo(() => observations.map((o, i) => ({ o, i })).sort((a, b) => b.o.step_idx - a.o.step_idx || b.i - a.i), [observations]);
  const deadClicks = steps.filter(isDeadClick).length;
  // Guide / stop: both need a signed-in user and only make sense while the agent is still working.
  const gate = useTokenGate();
  const [guideText, setGuideText] = useState('');
  const [busy, setBusy] = useState<'guide' | 'stop' | null>(null);
  const [notice, setNotice] = useState('');
  const [controlError, setControlError] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => { setGuideText(''); setNotice(''); setControlError(''); setConfirmStop(false); }, [id]);
  const explain = (e: unknown): string =>
    e instanceof ApiError && e.status === 409 ? 'This agent has already finished, so it can no longer be guided or stopped.'
      : e instanceof ApiError ? `The server refused this: ${e.message}` : 'Could not reach the server. Try again.';
  const sendGuide = () => {
    const text = guideText.trim();
    if (!runId || !text) return;
    gate.guard(async () => {
      setBusy('guide'); setControlError(''); setNotice('');
      try { await guideAgent(runId, id, text); setGuideText(''); setNotice('Sent. It will see this after its next action.'); }
      catch (e) { if (!gate.handleAuthError(e, sendGuide)) setControlError(explain(e)); }
      finally { setBusy(null); }
    });
  };
  const sendStop = () => {
    if (!runId) return;
    gate.guard(async () => {
      setBusy('stop'); setControlError(''); setNotice('');
      try { await stopAgent(runId, id); setNotice('Stopping. The agent ends its session after its next action, then answers the exit survey.'); }
      catch (e) { if (!gate.handleAuthError(e, sendStop)) setControlError(explain(e)); }
      finally { setBusy(null); setConfirmStop(false); }
    });
  };

  const siblings = useMemo(
    () => (session ? sessionList(run).filter((s) => s.persona_id === session.persona_id && s.repeat === session.repeat && s.session_id !== session.session_id) : []),
    [run, session],
  );

  // Previous / next agent in the run, so you can walk through all of them without going back to the grid.
  const ordered = sessionList(run);
  const at = session ? ordered.findIndex((s) => s.session_id === session.session_id) : -1;
  const agentLink = (s: { session_id: string }) => agentPath(runId ?? '', s.session_id);
  const prevAgent = at > 0 ? ordered[at - 1] : null;
  const nextAgent = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;

  const backTo = runId ? testPath(runId) : '/workspace';
  const back = <Link to={backTo} className="btn-ghost" style={{ textDecoration: 'none', paddingLeft: 0 }}>← Back to the test</Link>;

  if (!runId || (!run && !error)) {
    return <Page title="Agent" subtitle={back}><div className="card" aria-live="polite" style={{ padding: 32, color: C.muted2, fontSize: 13 }}>Loading agent…</div></Page>;
  }
  if (!run) {
    return <Page title="Agent" subtitle={back}><Empty title="This run could not be loaded"><span style={{ color: C.red }}>{error}</span></Empty></Page>;
  }
  if (!session) {
    return (
      <Page title="Agent not found" subtitle={back}>
        <Empty title={`No agent called “${id}” in this run`}>
          Run <span className="mono">{run.run_id}</span> has {Object.keys(run.sessions ?? {}).length} agents. <Link to={backTo} style={{ color: C.green }}>Pick one from the grid</Link>.
        </Empty>
      </Page>
    );
  }

  const used = Math.max(0, session.patience - session.actions_left);
  const t0 = steps[0]?.ts ?? 0;
  const state = agentState(session);
  const stateColor = TONE_COLOR[STATE_TONE[state]];

  // Live inspector: actions and observations in one stream, newest first.
  const tsByIdx = new Map(steps.map((s) => [s.idx, s.ts]));
  const events: LogEvent[] = [];
  const controls = session.controls ?? [];
  const firstIdx = steps[0]?.idx ?? 0;
  const lastIdx = steps[lastPos]?.idx ?? 0;
  steps.forEach((s) => {
    events.push({ key: `s${s.idx}`, ts: s.ts, stepIdx: s.idx, color: s.changed ? C.green : C.yellow, text: `${actionLabel(s)}${s.changed ? '' : ' (nothing changed)'}` });
    observations.forEach((o, i) => {
      if (o.step_idx === s.idx) events.push({ key: `o${i}`, ts: s.ts, stepIdx: s.idx, color: TONE_COLOR[KIND_TONE[o.kind]], text: o.text, tag: `${o.kind} ${o.severity}` });
    });
    controls.forEach((c, i) => {
      const after = Math.min(Math.max(c.step_idx, firstIdx), lastIdx); // a control sent before the first page loaded still shows
      if (after === s.idx) events.push({ key: `c${i}`, ts: s.ts, stepIdx: s.idx, color: C.blue, text: c.kind === 'stop' ? 'You stopped this agent' : `You suggested: ${c.text}`, tag: 'observer' });
    });
  });
  observations.forEach((o, i) => {
    if (!tsByIdx.has(o.step_idx)) events.push({ key: `o${i}`, ts: steps[lastPos]?.ts ?? t0, stepIdx: o.step_idx, color: TONE_COLOR[KIND_TONE[o.kind]], text: o.text, tag: `${o.kind} ${o.severity}` });
  });
  if (session.outcome && steps.length) {
    const end = steps[lastPos]!;
    events.push({ key: 'end', ts: end.ts, stepIdx: end.idx, color: session.outcome === 'completed' ? C.blue : C.red, text: session.outcome === 'error' && session.error ? `${OUTCOME_EVENT.error}: ${session.error}` : OUTCOME_EVENT[session.outcome] });
  }
  events.reverse();

  // Journey checklist: what this agent reached, and what others in the run reached that it did not.
  const visits = stageVisits(session);
  const reachedStages = new Set(visits.map((v) => v.stage));
  const unreached = orderedStages(sessionList(run)).filter((st) => !reachedStages.has(st));
  const lastStage = steps.length ? stageOf(steps[lastPos]!.url) : null;
  const viewedStage = step ? stageOf(step.url) : null;
  const alerts = observations.filter((o) => o.severity >= 4 && o.kind !== 'delight');
  const liveText = running
    ? (follow ? `Following live, step ${step?.idx ?? 0}` : `Paused on step ${step?.idx ?? 0} while the agent continues`)
    : session.status === 'queued' ? 'Waiting for a container' : `Session finished after ${Math.max(0, steps.length - 1)} actions`;

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 24px 64px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', minWidth: 0 }}>
          {back}
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(session.persona), color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(session.persona)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px' }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{session.persona}</h1>
              <span className="mono" style={{ fontSize: 12, color: C.muted }}>{session.session_id}</span>
              <Tag tone={STATE_TONE[state]}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: stateColor, animation: running ? 'pp-pulse 1.4s ease-in-out infinite' : undefined }} />
                {STATE_LABEL[state]}
              </Tag>
            </div>
            <div style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>Variant {session.variant.toUpperCase()} · {session.device} · {session.savviness} tech savviness</div>
          </div>
        </div>
        <nav aria-label="Other agents" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {prevAgent && <Link to={agentLink(prevAgent)} className="btn-ghost" style={{ textDecoration: 'none' }} title={`${prevAgent.persona}, variant ${prevAgent.variant.toUpperCase()}`}>‹ Previous agent</Link>}
          {nextAgent && <Link to={agentLink(nextAgent)} className="btn-ghost" style={{ textDecoration: 'none' }} title={`${nextAgent.persona}, variant ${nextAgent.variant.toUpperCase()}`}>Next agent ›</Link>}
          {siblings.map((s) => (
            <Link key={s.session_id} to={agentPath(run.run_id, s.session_id)} className="btn-secondary" style={{ textDecoration: 'none' }}>
              Compare with variant {s.variant.toUpperCase()} →
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]" style={{ gap: 16, alignItems: 'start' }}>
        {/* ---------- main column ---------- */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            ref={viewerRef}
            tabIndex={0}
            role="group"
            aria-label="Browser viewport and step scrubber. Use the left and right arrow keys to move between steps."
            onKeyDown={onKeyDown}
            className="card"
            style={{ overflow: 'hidden', outlineOffset: 2, scrollMarginTop: 60 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
              <span aria-hidden="true" style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {[C.border2, C.border2, C.border2].map((c, i) => <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
              </span>
              <div className="mono" title={step?.url ?? ''} style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 10px', fontSize: 12, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {step?.url || 'about:blank'}
              </div>
              {running && <Tag tone={follow ? 'green' : 'yellow'} pulse={follow}><span className={follow ? 'dot-green' : 'dot-yellow'} /> LIVE</Tag>}
            </div>

            {step ? (
              <Screenshot
                runId={run.run_id} sessionId={session.session_id} idx={step.idx} nextStep={nextStep} device={session.device}
                maxHeight={session.device === 'mobile' ? 620 : undefined}
                style={{ border: 'none', borderRadius: 0, minHeight: 200, alignItems: 'center' }}
              />
            ) : (
              <div style={{ padding: '80px 24px', textAlign: 'center', color: C.muted2, fontSize: 13, background: '#000' }}>
                {session.status === 'queued' ? 'Waiting for a container. The browser appears here as soon as the first page loads.' : 'No screens were recorded for this session.'}
              </div>
            )}

            <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="btn-secondary" aria-label="Previous step" disabled={pos <= 0} onClick={() => selectPos(pos - 1)} style={{ padding: '4px 10px' }}>←</button>
                  <button type="button" className="btn-secondary" aria-label="Next step" disabled={pos < 0 || pos >= lastPos} onClick={() => selectPos(pos + 1)} style={{ padding: '4px 10px' }}>→</button>
                </div>
                <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>step {step?.idx ?? 0} of {Math.max(0, lastPos)}</span>
                <span aria-live="polite" style={{ fontSize: 12, color: C.muted2, flex: 1, minWidth: 120 }}>{liveText}</span>
                {running && (
                  <button
                    type="button" aria-pressed={follow} className="btn-secondary"
                    onClick={() => { if (follow && step) setPinnedIdx(step.idx); setFollow(!follow); }}
                    style={{ padding: '4px 10px', fontSize: 12, color: follow ? C.green : C.muted2, borderColor: follow ? 'rgba(var(--pp-accent-rgb),0.35)' : C.border }}
                  >
                    Following live
                  </button>
                )}
                {!follow && pos < lastPos && (
                  <button type="button" className="btn-primary" onClick={() => setFollow(true)} style={{ padding: '4px 10px', fontSize: 12 }}>
                    {running ? 'Jump to live' : 'Jump to last step'}
                  </button>
                )}
              </div>
              <div ref={stripRef} role="group" aria-label="Steps" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, position: 'relative' }}>
                {steps.map((s, i) => {
                  const on = i === pos; const dead = isDeadClick(s); const hasObs = obsByStep.has(s.idx);
                  return (
                    <button
                      key={s.idx} type="button" ref={on ? chipRef : undefined} aria-pressed={on} onClick={() => selectPos(i)}
                      aria-label={`Step ${s.idx}, ${shortAction(s)}${dead ? ', dead click' : ''}${hasObs ? ', has observations' : ''}`}
                      title={actionLabel(s)}
                      className="mono"
                      style={{
                        flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, cursor: 'pointer',
                        padding: '5px 9px', borderRadius: 5, fontSize: 11, minWidth: 52,
                        background: on ? 'rgba(var(--pp-accent-rgb),0.12)' : dead ? 'rgba(var(--pp-red-rgb),0.08)' : C.bg,
                        border: `1px solid ${on ? C.green : dead ? 'rgba(var(--pp-red-rgb),0.45)' : C.border}`,
                        color: dead ? C.red : on ? C.text : C.muted2,
                      }}
                    >
                      <span style={{ color: on ? C.green : dead ? C.red : C.muted, fontSize: 10 }}>{s.idx}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{shortAction(s)}</span>
                      {hasObs && <span aria-hidden="true" style={{ position: 'absolute', top: 5, right: 6, width: 6, height: 6, borderRadius: '50%', background: C.yellow }} />}
                    </button>
                  );
                })}
                {steps.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>No steps yet.</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: 11, color: C.muted, marginTop: 4 }}>
                <span><span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: `2px solid ${C.green}`, marginRight: 5 }} />where the agent clicked next</span>
                <span><span className="dot-red" aria-hidden="true" style={{ marginRight: 5 }} />dead click</span>
                <span><span className="dot-yellow" aria-hidden="true" style={{ marginRight: 5 }} />has an observation</span>
              </div>
            </div>
          </div>

          <section className="card" aria-labelledby="ad-journey" style={{ padding: 16 }}>
            <SectionLabel>Journey · variant {session.variant.toUpperCase()}</SectionLabel>
            <h2 id="ad-journey" style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{session.goal || 'Complete the task on this site'}</h2>
            {visits.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>The agent has not loaded the first page yet.</div>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {visits.map((v, i) => {
                const isLast = v.stage === lastStage;
                const stopped = isLast && session.outcome != null && session.outcome !== 'completed';
                const now = isLast && session.outcome == null;
                const color = stopped ? C.red : now ? C.yellow : C.green;
                const viewing = v.stage === viewedStage;
                return (
                  <li key={v.stage} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                    <button type="button" onClick={() => selectIdx(v.firstIdx)} aria-current={viewing ? 'step' : undefined} title={`Show step ${v.firstIdx}, where the agent first reached ${v.stage}`} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 8px', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                      background: viewing ? 'rgba(var(--pp-accent-rgb),0.06)' : 'transparent', color: C.text, fontFamily: 'inherit', fontSize: 13,
                    }}>
                      {now
                        ? <span aria-hidden="true" style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="dot-yellow" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} /></span>
                        : stopped
                          ? <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}><circle cx="10" cy="10" r="7.5" fill="none" stroke={C.red} strokeWidth="1.6" /><path d="M7 7l6 6M13 7l-6 6" stroke={C.red} strokeWidth="1.6" strokeLinecap="round" /></svg>
                          : <CheckIcon color={C.green} />}
                      <span style={{ fontWeight: isLast ? 600 : 400, flex: 1, minWidth: 0 }}>
                        {v.stage}
                        {now && <span style={{ color, fontWeight: 400 }}> · here now</span>}
                        {stopped && <span style={{ color, fontWeight: 400 }}> · stopped here, {session.outcome === 'gave_up' ? 'gave up' : session.outcome === 'out_of_steps' ? 'out of patience' : 'session crashed'}</span>}
                        {isLast && session.outcome === 'completed' && <span style={{ color: C.blue, fontWeight: 400 }}> · goal reached</span>}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: v.noChange > 0 ? C.yellow : C.muted, whiteSpace: 'nowrap' }}>
                        {v.actions} {v.actions === 1 ? 'action' : 'actions'}{v.noChange > 0 ? ` · ${v.noChange} did nothing` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
              {unreached.map((st) => (
                <li key={st} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                  <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px dashed ${C.border2}`, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{st}</span>
                  <span style={{ fontSize: 11 }}>not reached by this agent</span>
                </li>
              ))}
            </ol>
          </section>

          {session.status !== 'finished' && (
            <section className="card" aria-labelledby="ad-guide" style={{ padding: 16 }}>
              <h2 id="ad-guide" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Guide this agent</h2>
              <p style={{ margin: '4px 0 12px', fontSize: 12, lineHeight: 1.55, color: C.muted2 }}>
                The agent reads your suggestion after its next action and decides, in character, whether to follow it. Stopping ends the session and it answers the exit survey.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); sendGuide(); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <label htmlFor="ad-guide-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Suggestion for {session.persona}</label>
                <input
                  id="ad-guide-input" className="input" maxLength={300} value={guideText} disabled={busy != null}
                  onChange={(e) => { setGuideText(e.target.value); setNotice(''); setControlError(''); }}
                  placeholder="Suggest something, e.g. Try checking out as a guest" style={{ flex: '1 1 260px', width: 'auto', minWidth: 0 }}
                />
                <button type="submit" className="btn-primary" disabled={busy != null || !guideText.trim()}>{busy === 'guide' ? 'Sending…' : 'Send suggestion'}</button>
                <button
                  type="button" className="btn-secondary" disabled={busy != null}
                  onClick={() => (confirmStop ? sendStop() : setConfirmStop(true))} onBlur={() => setConfirmStop(false)}
                  style={confirmStop ? { color: C.red, borderColor: 'rgba(var(--pp-red-rgb),0.5)' } : undefined}
                >
                  {busy === 'stop' ? 'Stopping…' : confirmStop ? 'Click again to stop' : 'Stop agent'}
                </button>
              </form>
              <div aria-live="polite" style={{ minHeight: 18, marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>
                {controlError ? <span role="alert" style={{ color: C.red }}>{controlError}</span> : notice ? <span style={{ color: C.green }}>{notice}</span> : null}
              </div>
            </section>
          )}

          {session.has_video && (
            <section className="card" aria-labelledby="ad-video" style={{ padding: 16 }}>
              <div id="ad-video"><SectionLabel>Screen recording</SectionLabel></div>
              <video controls preload="metadata" src={videoUrl(run.run_id, session.session_id)} style={{ display: 'block', width: '100%', maxWidth: session.device === 'mobile' ? 300 : '100%', maxHeight: 620, margin: '0 auto', background: '#000', borderRadius: 6 }} />
              <p style={{ margin: '10px 0 0', fontSize: 12, color: C.muted2, lineHeight: 1.5 }}>
                This is the unedited recording from the agent's container, including the pauses while the persona thinks about what to do next.
              </p>
            </section>
          )}
        </div>

        {/* ---------- sidebar ---------- */}
        <aside style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="card" aria-labelledby="ad-inspector" style={{ padding: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: running ? C.green : C.muted, animation: running ? 'pp-pulse 1.4s ease-in-out infinite' : undefined }} />
              <h2 id="ad-inspector" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Live inspector</h2>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{steps.length} steps · newest first</span>
            </div>
            {events.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>Nothing logged yet. Each browser action appears here as it happens.</div>
            ) : (
              <ol aria-label="Event log" style={{ listStyle: 'none', margin: '0 -6px', padding: 0, maxHeight: 300, overflowY: 'auto' }}>
                {events.map((e) => {
                  const on = step?.idx === e.stepIdx;
                  return (
                    <li key={e.key}>
                      <button type="button" onClick={() => selectIdx(e.stepIdx)} aria-current={on ? 'step' : undefined} title={`Show step ${e.stepIdx}`} style={{
                        display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 8, width: '100%', padding: '4px 6px', border: 'none', borderRadius: 4, textAlign: 'left', cursor: 'pointer',
                        background: on ? 'rgba(var(--pp-accent-rgb),0.07)' : 'transparent', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45,
                      }}>
                        <span className="mono" style={{ fontSize: 10, color: C.muted, paddingTop: 2 }}>{fmtOffset(e.ts - t0)}</span>
                        <span style={{ color: e.color, overflowWrap: 'anywhere' }}>
                          {e.tag && <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 6, opacity: 0.85 }}>{e.tag}</span>}
                          {e.text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <Card label={`Current thought · step ${step?.idx ?? 0}`} labelledBy="ad-thought">
            {step ? (
              <>
                <div className="mono" style={{ fontSize: 12, color: C.muted2, marginBottom: 8, overflowWrap: 'anywhere' }}>{actionLabel(step)}</div>
                {step.reasoning ? <Quote>{step.reasoning}</Quote> : <div style={{ fontSize: 13, color: C.muted }}>{step.action === 'open' ? 'The page has just loaded. The persona has not decided anything yet.' : 'No reasoning was recorded for this step.'}</div>}
                {!step.changed && <div style={{ marginTop: 8 }}><Tag tone="red">nothing changed on the page</Tag></div>}
              </>
            ) : <div style={{ fontSize: 13, color: C.muted }}>The agent has not started yet.</div>}
          </Card>

          <Card label="Notable alerts" labelledBy="ad-alerts">
            {alerts.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>Nothing serious so far.</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.map((o, i) => {
                  const red = o.kind === 'bug';
                  return (
                    <li key={i}>
                      <button type="button" onClick={() => selectIdx(o.step_idx)} title={`Show step ${o.step_idx}`} style={{
                        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: 6, fontFamily: 'inherit',
                        background: red ? 'rgba(var(--pp-red-rgb),0.08)' : 'rgba(var(--pp-yellow-rgb),0.07)', border: `1px solid ${red ? 'rgba(var(--pp-red-rgb),0.3)' : 'rgba(var(--pp-yellow-rgb),0.28)'}`,
                      }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: red ? C.red : C.yellow }}>{o.kind[0]!.toUpperCase() + o.kind.slice(1)} · severity {o.severity} · step {o.step_idx}</span>
                        <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, color: C.muted2, marginTop: 2 }}>{o.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {session.exit_survey && <SurveyCard survey={session.exit_survey} session={session} />}

          <Card label="Status" labelledBy="ad-status">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <SessionTag s={session} />
              <span style={{ fontSize: 12, color: C.muted2 }}>{session.actions_left} of {session.patience} actions of patience left</span>
            </div>
            <PatienceBar left={session.actions_left} total={session.patience || 1} />
            <div style={{ marginTop: 10 }}>
              <Row k="Actions used">{used}</Row>
              <Row k="Dead clicks"><span style={{ color: deadClicks > 0 ? C.red : C.text }}>{deadClicks}</span></Row>
              {session.duration_s != null && <Row k="Duration">{fmtOffset(session.duration_s)} min</Row>}
              {session.tokens != null && <Row k="Tokens">{fmtTokens(session.tokens)}</Row>}
            </div>
            {session.error && <div role="alert" className="mono" style={{ marginTop: 8, fontSize: 11, color: C.red, overflowWrap: 'anywhere', lineHeight: 1.5 }}>{session.error}</div>}
          </Card>

          <Card label={`Observations · ${observations.length}`} labelledBy="ad-obs">
            {observations.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>{running ? 'Nothing noted yet. Observations appear here as the persona reacts to the site.' : 'This persona did not note anything.'}</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {obsNewestFirst.map(({ o, i }) => {
                  const here = step?.idx === o.step_idx;
                  return (
                    <li key={i} style={{ padding: '8px 10px', borderRadius: 6, background: here ? 'rgba(var(--pp-accent-rgb),0.06)' : C.bg, border: `1px solid ${here ? 'rgba(var(--pp-accent-rgb),0.4)' : C.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <KindTag kind={o.kind} severity={o.severity} />
                        <button type="button" className="btn-ghost mono" aria-current={here ? 'step' : undefined} onClick={() => selectIdx(o.step_idx)} style={{ padding: '1px 6px', fontSize: 11, color: here ? C.green : C.muted2 }}>
                          step {o.step_idx}
                        </button>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: C.text }}>{o.text}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card label="Persona" labelledBy="ad-persona">
            <div style={{ fontSize: 15, fontWeight: 600 }}>{session.persona}</div>
            {session.bio && <p style={{ margin: '6px 0 10px', fontSize: 13, color: C.muted2, lineHeight: 1.5 }}>{session.bio}</p>}
            <Row k="Device">{session.device}</Row>
            <Row k="Tech savviness">{session.savviness}</Row>
            <Row k="Reading style">{session.reading_style === 'reads_everything' ? 'reads everything' : session.reading_style}</Row>
            <Row k="Variant">{session.variant.toUpperCase()}</Row>
            <Row k="Repeat">{session.repeat + 1}</Row>
            {session.goal && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Goal</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{session.goal}</div>
              </div>
            )}
          </Card>
        </aside>
      </div>
      {gate.dialog}
    </div>
  );
}
