// Landing: what the product does, shown with the most recent real test (or a captioned example).
import { Link } from 'react-router';
import { sessionList, useRun, useRuns, type RunState, type SessionState } from '../lib/api';
import { SENTIMENT_HELP, agentState, initials, pct, sentimentOf, sentimentTone, testName, testPath } from '../lib/derive';
import { C, Tag } from '../lib/ui';
import { Avatar } from './newtest/bits';

type Cell = 'ok' | 'warn' | 'dead';
interface Row { id: string; persona: string; variant: string; cells: Cell[] }
interface Snapshot {
  example: boolean; name: string; live: boolean; href: string | null;
  rows: Row[]; sentiment: number | null; total: number; done: number; blocked: number; working: number; friction: number | null;
}
const CELL_COLOR: Record<Cell, string> = { ok: C.green, warn: C.yellow, dead: C.red };
const TONE_COLOR = { green: C.green, yellow: C.yellow, red: C.red, muted: C.muted2 } as const;

function cellsOf(s: SessionState): Cell[] {
  const flagged = new Set(s.observations.filter((o) => o.severity >= 3).map((o) => o.step_idx));
  return s.steps.map((st) => (flagged.has(st.idx) ? 'warn' : st.changed ? 'ok' : 'dead'));
}

function fromRun(run: RunState): Snapshot {
  const sessions = sessionList(run);
  const rows = sessions.map((s) => ({ id: s.session_id, persona: s.persona, variant: s.variant, cells: cellsOf(s) }));
  const cells = rows.flatMap((r) => r.cells);
  const states = sessions.map(agentState);
  const done = states.filter((x) => x === 'done').length;
  const blocked = states.filter((x) => x === 'blocked').length;
  return {
    example: false, name: testName(run), live: run.status !== 'finished' && run.status !== 'failed', href: testPath(run.run_id),
    rows, sentiment: sentimentOf(sessions), total: sessions.length, done, blocked, working: sessions.length - done - blocked,
    friction: cells.length ? cells.filter((c) => c !== 'ok').length / cells.length : null,
  };
}

// Shown only when there is no test to load. Captioned "Example" wherever it appears.
const g = (n: number): Cell[] => Array.from({ length: n }, () => 'ok' as const);
const EXAMPLE: Snapshot = {
  example: true, name: 'Checkout: clean vs dark patterns', live: false, href: null,
  rows: [
    { id: 'm-a', persona: 'Margaret Ellis', variant: 'a', cells: g(14) },
    { id: 'm-b', persona: 'Margaret Ellis', variant: 'b', cells: [...g(3), 'warn', ...g(4), 'warn', 'dead', 'dead', ...g(2), 'warn', 'dead', 'dead'] },
    { id: 'd-a', persona: 'Dev Patel', variant: 'a', cells: g(11) },
    { id: 'd-b', persona: 'Dev Patel', variant: 'b', cells: [...g(2), 'warn', ...g(5), 'warn', ...g(3), 'dead', 'warn', ...g(2)] },
    { id: 's-a', persona: 'Sofia Ramirez', variant: 'a', cells: [...g(6), 'dead', ...g(6)] },
    { id: 's-b', persona: 'Sofia Ramirez', variant: 'b', cells: [...g(3), 'warn', ...g(3), 'dead', 'warn', 'dead', 'dead'] },
  ],
  sentiment: 0.62, total: 6, done: 4, blocked: 2, working: 0, friction: 0.19,
};

export default function Landing() {
  const { runs, error: runsError } = useRuns();
  const newest = runs?.[0]?.run_id ?? null;
  const { run, error: runError } = useRun(newest);
  const usable = run && Object.keys(run.sessions).length > 0 ? run : null;
  const failed = runsError != null || runError != null || (runs != null && runs.length === 0) || (run != null && !usable);
  const snap: Snapshot | null = usable ? fromRun(usable) : failed ? EXAMPLE : null;

  return (
    <div>
      <style>{CSS}</style>
      <section className="ld-hero">
        <div style={{ minWidth: 0 }}>
          <span className="tag-green mono" style={{ fontSize: 10, letterSpacing: '0.1em', padding: '4px 10px' }}><span className="dot-green" />AGENT POPULATION TESTING</span>
          <h1 style={{ margin: '22px 0 20px', fontSize: 'clamp(34px, 5.2vw, 52px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05 }}>Build a population of sandboxed customer agents</h1>
          <p style={{ margin: 0, color: C.muted2, fontSize: 16, lineHeight: 1.65, maxWidth: 480 }}>
            Give two variants of a site to a panel of AI personas. Each one uses a real Chromium browser in its own container, thinking out loud while you watch.
            When they finish, an evaluator names the winner and points at the screenshots that prove it.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}>
            <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', padding: '11px 22px', fontSize: 14 }}>Get started</Link>
            <button type="button" className="btn-secondary" style={{ padding: '11px 22px', fontSize: 14 }} onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>See how it works</button>
          </div>
        </div>

        <div style={{ minWidth: 0 }} aria-label={snap?.example ? 'Example test' : 'Latest test'}>
          {snap ? <Cards snap={snap} /> : <div aria-busy="true" style={{ display: 'grid', gap: 12 }}><div className="card" style={{ height: 210, opacity: 0.5 }} /><div className="ld-pair"><div className="card" style={{ height: 170, opacity: 0.5 }} /><div className="card" style={{ height: 170, opacity: 0.5 }} /></div></div>}
        </div>
      </section>

      <section className="ld-band">
        <div className="ld-cols">
          <Pillar title="Parallel by default">Every persona runs both variants at the same time, each in its own cloud container. A six-agent test takes about three minutes.</Pillar>
          <Pillar title="Observe every action">Watch each click, each screenshot and the reason the persona gave for it, live. Dead clicks and lost patience show up as they happen.</Pillar>
          <Pillar title="Decide with evidence">Completion is checked in code, not taken on the agent's word. The verdict links every issue to the step and screenshot where it happened.</Pillar>
        </div>
      </section>

      <section id="how-it-works" className="ld-band" style={{ scrollMarginTop: 64 }}>
        <div className="ld-inner">
          <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.14em' }}>HOW IT WORKS</div>
          <h2 style={{ margin: '12px 0 32px', fontSize: 'clamp(24px, 3.4vw, 30px)', fontWeight: 700, letterSpacing: '-0.03em' }}>Three steps, about three minutes</h2>
          <ol className="ld-steps">
            <HowStep n="01" title="Set up">Choose what to compare, the demo shop or two URLs of your own, and who tests it. One screen, one button.</HowStep>
            <HowStep n="02" title="Watch live">Each agent opens its browser and gets to work. You see what they see, what they think and how much patience they have left.</HowStep>
            <HowStep n="03" title="Read the verdict">A winner with a confidence level, the issues ranked by severity, and the screenshots behind each one.</HowStep>
          </ol>
          <div style={{ marginTop: 36 }}>
            <Link to="/new" className="ld-link">Set up a test</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Cards({ snap }: { snap: Snapshot }) {
  const tone = sentimentTone(snap.sentiment);
  const completion = snap.total ? snap.done / snap.total : null;
  const personas = [...new Set(snap.rows.map((r) => r.persona))];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 12, color: C.muted2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 160px' }}>{snap.name}</span>
          {snap.example ? <Tag>Example</Tag> : snap.live ? <Tag tone="green" pulse><span className="dot-green" />Live</Tag> : <Tag tone="blue">Finished</Tag>}
        </div>
        <div role="img" aria-label={`Journey matrix: ${snap.rows.length} agents, one square per step`} style={{ display: 'grid', gap: 5, marginTop: 16 }}>
          {snap.rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span className="mono" title={`${r.persona}, variant ${r.variant.toUpperCase()}`} style={{ flex: 'none', width: 40, fontSize: 10, color: C.muted, lineHeight: '11px' }}>{initials(r.persona)}·{r.variant.toUpperCase()}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3, minWidth: 0 }}>
                {r.cells.length === 0 && <span style={{ width: 11, height: 11, borderRadius: 2, background: C.border }} />}
                {r.cells.map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 2, background: CELL_COLOR[c], opacity: c === 'ok' ? 0.85 : 1 }} />)}
              </span>
            </div>
          ))}
        </div>
        <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 16, fontSize: 10, color: C.muted }}>
          <Legend color={C.green}>page changed</Legend><Legend color={C.yellow}>serious observation</Legend><Legend color={C.red}>nothing happened</Legend>
        </div>
      </div>

      <div className="ld-pair">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: C.muted }}>Agents</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {personas.slice(0, 6).map((p) => <span key={p} title={p} style={{ display: 'inline-flex' }}><Avatar name={p} size={30} /></span>)}
          </div>
          <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 18, fontSize: 12 }}>
            <span><span style={{ color: C.text, fontSize: 20 }}>{snap.total}</span> <span style={{ color: C.muted }}>agents</span></span>
            <span><span style={{ color: C.green, fontSize: 20 }}>{snap.done}</span> <span style={{ color: C.muted }}>done</span></span>
            <span><span style={{ color: snap.blocked ? C.red : C.muted2, fontSize: 20 }}>{snap.blocked}</span> <span style={{ color: C.muted }}>blocked</span></span>
          </div>
          {snap.working > 0 && <div style={{ fontSize: 12, color: C.muted2, marginTop: 8 }}>{snap.working} still working</div>}
        </div>

        <div className="card" style={{ padding: 20 }} title={SENTIMENT_HELP}>
          <div style={{ fontSize: 12, color: C.muted }}>Panel sentiment</div>
          <div className="mono" style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 12, color: TONE_COLOR[tone] }}>{pct(snap.sentiment)}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>positive</div>
          <Meter label="Completion" value={completion} color={C.green} />
          <Meter label="Steps with friction" value={snap.friction} color={C.yellow} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        {snap.example ? 'Example. Illustrative data, shown because no test could be loaded.'
          : <>Real data from the most recent test. {snap.href && <Link to={snap.href} className="ld-link" style={{ fontSize: 12 }}>Open it</Link>}</>}
      </div>
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}><span>{label}</span><span className="mono">{pct(value)}</span></div>
      <div className="progress-bar" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${Math.round((value ?? 0) * 100)}%`, background: color }} /></div>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{children}</span>;
}

function Pillar({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: '10px 0 0', fontSize: 14, color: C.muted2, lineHeight: 1.65 }}>{children}</p>
    </div>
  );
}

function HowStep({ n, title, children }: { n: string; title: string; children: string }) {
  return (
    <li className="card" style={{ padding: 24 }}>
      <div className="mono" style={{ fontSize: 22, color: C.green, lineHeight: 1 }}>{n}</div>
      <h3 style={{ margin: '18px 0 0', fontSize: 16, fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: C.muted2, lineHeight: 1.65 }}>{children}</p>
    </li>
  );
}

const CSS = `
.ld-hero { max-width: 1120px; margin: 0 auto; padding: 88px 24px 96px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 460px); gap: 72px; align-items: center; }
.ld-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.ld-band { border-top: 1px solid #1e2230; }
.ld-cols, .ld-inner { max-width: 1120px; margin: 0 auto; padding: 64px 24px; }
.ld-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 48px; }
.ld-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.ld-link { color: #4ade80; font-size: 14px; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(74,222,128,0.35); }
.ld-link:hover { text-decoration-color: #4ade80; }
@media (max-width: 900px) {
  .ld-hero { grid-template-columns: minmax(0, 1fr); gap: 48px; padding: 48px 16px 64px; }
  .ld-cols, .ld-steps { grid-template-columns: minmax(0, 1fr); }
  .ld-cols { gap: 32px; }
  .ld-cols, .ld-inner { padding: 48px 16px; }
}
@media (max-width: 440px) { .ld-pair { grid-template-columns: minmax(0, 1fr); } }
`;
