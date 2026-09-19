import { useParams, Link } from 'react-router';
import { PERSONAS } from './Personas';
import { useTheme } from '../context/ThemeContext';

const TESTS_FOR_PERSONA: Record<string, { name: string; date: string; outcome: string; variant: string }[]> = {
  margaret: [
    { name: 'Checkout: clean vs dark patterns', date: '19 Sept 2026', outcome: 'gave_up',    variant: 'B' },
    { name: 'Clean checkout vs redesign',        date: '19 Sept 2026', outcome: 'completed',  variant: 'A' },
  ],
  dev: [
    { name: 'Checkout: clean vs dark patterns', date: '19 Sept 2026', outcome: 'completed',  variant: 'A' },
    { name: 'Clean checkout vs redesign',        date: '19 Sept 2026', outcome: 'completed',  variant: 'A' },
  ],
  sofia: [
    { name: 'Checkout: clean vs dark patterns', date: '19 Sept 2026', outcome: 'out_of_steps', variant: 'B' },
  ],
};

const OUTCOME: Record<string, { bg: string; color: string; label: string }> = {
  completed:    { bg: 'rgba(74,222,128,0.08)',  color: '#4ade80',  label: 'completed'     },
  gave_up:      { bg: 'rgba(248,113,113,0.08)', color: '#f87171',  label: 'gave up'       },
  out_of_steps: { bg: 'rgba(250,204,21,0.08)',  color: '#facc15',  label: 'out of steps'  },
};

const SAVVY_PCT: Record<string, number> = { low: 25, medium: 58, high: 92 };

export default function AgentDetail() {
  const { id } = useParams();
  const { c } = useTheme();
  const persona = PERSONAS.find(p => p.id === id) ?? PERSONAS[0];
  const tests = TESTS_FOR_PERSONA[persona.id] ?? [];

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '36px 48px' }}>
      <Link to="/personas" style={{ fontSize: 12, color: c.text3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
        ← Personas
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="card-glass" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: persona.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, color: '#fff', flexShrink: 0,
                boxShadow: `0 0 20px ${persona.color}44`,
              }}>{persona.initials}</div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: '0 0 3px', letterSpacing: '-0.02em' }}>{persona.name}</h1>
                <div style={{ fontSize: 12, color: c.text3 }}>{persona.age} years old · {persona.device}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: c.text2, lineHeight: 1.75, margin: 0 }}>{persona.bio}</p>
          </div>

          <div className="card-glass" style={{ padding: '20px 24px' }}>
            <SectionLabel c={c}>Goals</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {persona.goals.map(g => (
                <div key={g} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(74,222,128,0.5)" strokeWidth="1.2"/>
                    <path d="M4 6.5l2 2 3.5-3.5" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 13, color: c.text, lineHeight: 1.55 }}>{g}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-glass" style={{ padding: '20px 24px' }}>
            <SectionLabel c={c}>Frustrations</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {persona.frustrations.map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(248,113,113,0.4)" strokeWidth="1.2"/>
                    <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="#f87171" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 13, color: c.text, lineHeight: 1.55 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {tests.length > 0 && (
            <div className="card-glass" style={{ padding: '20px 24px' }}>
              <SectionLabel c={c}>Test history</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {tests.map((t, i) => {
                  const o = OUTCOME[t.outcome] ?? OUTCOME.completed;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--glass-bg)', borderRadius: 7, border: '1px solid var(--glass-border)' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: c.text, marginBottom: 2 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: c.text4 }}>{t.date} · Variant {t.variant}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: o.bg, color: o.color, flexShrink: 0, fontWeight: 600 }}>{o.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-glass" style={{ padding: '20px 22px' }}>
            <SectionLabel c={c}>Traits</SectionLabel>
            <Trait c={c} label="Tech savviness" value={persona.tech_savviness} pct={SAVVY_PCT[persona.tech_savviness]} color="#4ade80" />
            <Trait c={c} label="Patience" value={`${persona.patience_steps} steps`} pct={(persona.patience_steps / 40) * 100} color="#60a5fa" />
            <div style={{ height: 1, background: 'var(--glass-border)', margin: '14px 0' }} />
            <KV c={c} label="Device" value={persona.device} />
            <KV c={c} label="Reading style" value={persona.reading_style === 'reads_everything' ? 'reads everything' : 'skims'} />
          </div>

          <div className="card-glass" style={{ padding: '20px 22px' }}>
            <SectionLabel c={c}>Demo fixtures</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Address', '418 Maple Avenue, Columbus OH'],
                ['ZIP', '43215'],
                ['Phone', '(614) 555-0142'],
                ['Email', 'firstname.lastname@example.com'],
                ['Card', '4242 4242 4242 4242'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: c.text4, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k}</div>
                  <div style={{ fontSize: 11, color: c.text2, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type C = { text3: string; text4: string };

function SectionLabel({ children, c }: { children: React.ReactNode; c: C }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>{children}</div>;
}

function Trait({ label, value, pct, color, c }: { label: string; value: string; pct: number; color: string; c: { text2: string; text: string } }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: c.text2 }}>{label}</span>
        <span style={{ fontSize: 11, color: c.text, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
      </div>
      <div style={{ height: 4, background: 'var(--progress-track)', borderRadius: 2 }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.4s', opacity: 0.7 }} />
      </div>
    </div>
  );
}

function KV({ label, value, c }: { label: string; value: string; c: { text2: string; text: string } }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: c.text2 }}>{label}</span>
      <span style={{ fontSize: 11, color: c.text }}>{value}</span>
    </div>
  );
}
