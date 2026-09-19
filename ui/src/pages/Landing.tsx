// / — what the product is, how a test runs, and the latest real result if there is one.
import { Link } from 'react-router';
import { fmtTime, useRuns } from '../lib/api';
import { C, SectionLabel, Tag } from '../lib/ui';

const STEPS: { title: string; body: string }[] = [
  { title: 'Define the test', body: 'Choose personas, two variants of a site (or the built-in demo shop), and the goal they should try to reach.' },
  { title: 'Agents run in isolation', body: 'Every persona and variant pair gets its own Modal container with a real Chromium browser. Nothing is shared between sessions.' },
  { title: 'Watch it live', body: 'Follow each agent step by step: what it clicked, why, the screen it saw, and how much patience it has left.' },
  { title: 'Evidence-backed verdict', body: 'Metrics are computed in code. An evaluator then names a winner, or says there is none, and cites the exact steps behind every claim.' },
];

const OBSERVATION_KINDS = ['bug', 'friction', 'confusion', 'delight', 'opinion'];

export default function Landing() {
  const { runs } = useRuns();
  const latest = runs?.find((r) => r.status === 'finished' && r.winner);
  const clear = latest?.winner != null && latest.winner.trim().toLowerCase() !== 'no clear winner';
  const tone = latest?.confidence === 'high' ? 'green' : latest?.confidence === 'medium' ? 'yellow' : 'muted';

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 80px' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 40, alignItems: 'center', padding: '72px 0 56px' }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: C.green, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>A/B testing with synthetic users</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.08 }}>
            Watch synthetic users try both of your designs.
          </h1>
          <p style={{ margin: '20px 0 0', fontSize: 16, lineHeight: 1.65, color: C.muted2, maxWidth: 540 }}>
            Polypersona sends persona agents through two variants of a site in real browsers. Each has a device, a level of tech savviness and a hard budget of actions before it gives up.
            They record bugs, friction and confusion against the step where it happened, with a screenshot. You get metrics computed in code and a verdict that has to cite its evidence.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
            <Link to="/tools" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 14 }}>Start a test</Link>
            <Link to="/insights" className="btn-secondary" style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 14 }}>See the latest run</Link>
          </div>
        </div>

        <div className="card" aria-label="How a finding is recorded" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: C.muted2, marginBottom: 12 }}>How a finding is pinned down</div>
          <div className="mono" style={{ fontSize: 'clamp(14px, 3.4vw, 18px)', padding: '14px 16px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, overflowWrap: 'anywhere' }}>
            <span style={{ color: C.text }}>&lt;persona&gt;</span>
            <span style={{ color: C.muted }}>-</span>
            <span style={{ color: C.blue }}>&lt;variant&gt;</span>
            <span style={{ color: C.muted }}>-</span>
            <span style={{ color: C.muted2 }}>&lt;repeat&gt;</span>
            <span style={{ color: C.green }}>#&lt;step&gt;</span>
          </div>
          <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: 13, lineHeight: 1.5 }}>
            <dt className="mono" style={{ color: C.text, fontSize: 12 }}>persona</dt>
            <dd style={{ margin: 0, color: C.muted2 }}>who was browsing, with their bio, device and patience</dd>
            <dt className="mono" style={{ color: C.blue, fontSize: 12 }}>variant</dt>
            <dd style={{ margin: 0, color: C.muted2 }}>which design they were given</dd>
            <dt className="mono" style={{ color: C.green, fontSize: 12 }}>step</dt>
            <dd style={{ margin: 0, color: C.muted2 }}>the action it happened on, with the screenshot taken right after</dd>
          </dl>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.muted }}>Agents record</span>
            {OBSERVATION_KINDS.map((k) => <Tag key={k}>{k}</Tag>)}
            <span style={{ fontSize: 12, color: C.muted }}>at severity 1 to 5</span>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            The evaluator may only cite references in this form, so every issue in a verdict opens on the step that produced it.
          </p>
        </div>
      </section>

      {latest && (
        <section aria-label="Latest result" className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '10px 20px', alignItems: 'center', marginBottom: 56 }}>
          <span className="mono" style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Latest result</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: clear ? C.green : C.text }}>
            {clear ? `Variant ${latest.winner?.toUpperCase()} won` : 'No clear winner'}
          </span>
          {latest.confidence && <Tag tone={tone}>{latest.confidence} confidence</Tag>}
          <span style={{ fontSize: 12, color: C.muted2 }}>
            {[latest.sessions != null ? `${latest.sessions} sessions` : null, fmtTime(latest.created_at) || null].filter(Boolean).join(' · ')}
          </span>
          <Link to={`/insights?run=${encodeURIComponent(latest.run_id)}`} style={{ marginLeft: 'auto', color: C.green, textDecoration: 'none', fontSize: 13 }}>Read the verdict</Link>
        </section>
      )}

      <section>
        <SectionLabel>How it works</SectionLabel>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="card" style={{ padding: 18 }}>
              <div className="mono" style={{ fontSize: 12, color: C.green }}>{String(i + 1).padStart(2, '0')}</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 15, fontWeight: 600 }}>{s.title}</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: C.muted2 }}>{s.body}</p>
            </li>
          ))}
        </ol>
        <p style={{ margin: '20px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 720 }}>
          Synthetic users are a fast way to find where a flow breaks before real people hit it. They are not a substitute for real traffic, and every verdict lists its own caveats.
        </p>
      </section>
    </div>
  );
}
