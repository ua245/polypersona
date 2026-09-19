import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { fmtTokens, sessionList, useRun, useSelectedRunId, videoUrl, type ExitSurvey, type Observation, type SessionState, type Step } from '../lib/api';
import { C, Empty, KindTag, Page, PatienceBar, Screenshot, SectionLabel, SessionTag, Tag, stepLabel } from '../lib/ui';

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
        <div role="note" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.5, color: C.red, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
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
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const fallbackRunId = useSelectedRunId();
  const runId = params.get('run') ?? fallbackRunId;
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
  const siblings = useMemo(
    () => (session ? sessionList(run).filter((s) => s.persona_id === session.persona_id && s.repeat === session.repeat && s.session_id !== session.session_id) : []),
    [run, session],
  );

  const backTo = `/populations${runId ? `?run=${encodeURIComponent(runId)}` : ''}`;
  const back = <Link to={backTo} className="btn-ghost" style={{ textDecoration: 'none', paddingLeft: 0 }}>← All agents</Link>;

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
  const liveText = running
    ? (follow ? `Following live, step ${step?.idx ?? 0}` : `Paused on step ${step?.idx ?? 0} while the agent continues`)
    : session.status === 'queued' ? 'Waiting for a container' : `Session finished after ${Math.max(0, steps.length - 1)} actions`;

  return (
    <Page
      title={session.persona}
      subtitle={<span>variant {session.variant.toUpperCase()} · {session.device} · <span className="mono">{session.session_id}</span> in run <span className="mono">{run.run_id}</span></span>}
      actions={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {back}
          {siblings.map((s) => (
            <Link key={s.session_id} to={`/populations/${encodeURIComponent(s.session_id)}?run=${encodeURIComponent(run.run_id)}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
              Compare with variant {s.variant.toUpperCase()} →
            </Link>
          ))}
        </div>
      }
    >
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
                    style={{ padding: '4px 10px', fontSize: 12, color: follow ? C.green : C.muted2, borderColor: follow ? 'rgba(74,222,128,0.35)' : C.border }}
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
                      title={stepLabel(s)}
                      className="mono"
                      style={{
                        flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, cursor: 'pointer',
                        padding: '5px 9px', borderRadius: 5, fontSize: 11, minWidth: 52,
                        background: on ? 'rgba(74,222,128,0.12)' : dead ? 'rgba(248,113,113,0.08)' : C.bg,
                        border: `1px solid ${on ? C.green : dead ? 'rgba(248,113,113,0.45)' : C.border}`,
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

          <Card label={`Current thought · step ${step?.idx ?? 0}`} labelledBy="ad-thought">
            {step ? (
              <>
                <div className="mono" style={{ fontSize: 12, color: C.muted2, marginBottom: 8, overflowWrap: 'anywhere' }}>{stepLabel(step)}</div>
                {step.reasoning ? <Quote>{step.reasoning}</Quote> : <div style={{ fontSize: 13, color: C.muted }}>{step.action === 'open' ? 'The page has just loaded. The persona has not decided anything yet.' : 'No reasoning was recorded for this step.'}</div>}
                {!step.changed && <div style={{ marginTop: 8 }}><Tag tone="red">nothing changed on the page</Tag></div>}
              </>
            ) : <div style={{ fontSize: 13, color: C.muted }}>The agent has not started yet.</div>}
          </Card>

          <Card label={`Observations · ${observations.length}`} labelledBy="ad-obs">
            {observations.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>{running ? 'Nothing noted yet. Observations appear here as the persona reacts to the site.' : 'This persona did not note anything.'}</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {obsNewestFirst.map(({ o, i }) => {
                  const here = step?.idx === o.step_idx;
                  return (
                    <li key={i} style={{ padding: '8px 10px', borderRadius: 6, background: here ? 'rgba(74,222,128,0.06)' : C.bg, border: `1px solid ${here ? 'rgba(74,222,128,0.4)' : C.border}` }}>
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

          {session.exit_survey && <SurveyCard survey={session.exit_survey} session={session} />}
        </aside>
      </div>

      {/* ---------- activity log ---------- */}
      <section aria-labelledby="ad-log" style={{ marginTop: 32 }}>
        <div id="ad-log"><SectionLabel>Activity log · {steps.length} steps</SectionLabel></div>
        {steps.length === 0 ? (
          <Empty title="Nothing logged yet">Each browser action appears here with the persona's reasoning.</Empty>
        ) : (
          <ol className="card" style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'hidden' }}>
            {steps.map((s, i) => {
              const on = i === pos; const dead = isDeadClick(s);
              return (
                <li key={s.idx} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                  <button
                    type="button" aria-pressed={on} onClick={() => selectIdx(s.idx)}
                    style={{
                      display: 'grid', gridTemplateColumns: '44px 28px minmax(0,1fr)', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '10px 14px', border: 'none', borderLeft: `2px solid ${on ? C.green : 'transparent'}`, background: on ? 'rgba(74,222,128,0.05)' : 'transparent',
                      color: C.text, fontFamily: 'inherit', fontSize: 13,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 11, color: C.muted, paddingTop: 2 }}>{fmtOffset(s.ts - t0)}</span>
                    <span className="mono" style={{ fontSize: 11, color: on ? C.green : C.muted2, paddingTop: 2 }}>{s.idx}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="mono" style={{ display: 'block', fontSize: 12, color: dead ? C.red : C.text, overflowWrap: 'anywhere' }}>
                        {stepLabel(s)}{dead ? ' (nothing changed)' : ''}
                        {obsByStep.has(s.idx) && <span style={{ color: C.yellow }}> · {obsByStep.get(s.idx)} obs</span>}
                      </span>
                      {s.reasoning && <span style={{ display: 'block', color: C.muted2, marginTop: 3, lineHeight: 1.5 }}>{s.reasoning}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </Page>
  );
}
