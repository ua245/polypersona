import { Link } from 'react-router';
import { useTheme } from '../context/ThemeContext';

export const PERSONAS = [
  {
    id: 'margaret',
    initials: 'ME',
    color: '#ca8a04',
    name: 'Margaret Ellis',
    age: 68,
    device: 'desktop' as const,
    tech_savviness: 'low' as const,
    reading_style: 'reads_everything' as const,
    patience_steps: 22,
    bio: '68, retired school librarian in Ohio. Orders gifts online a few times a year, usually with her daughter on the phone walking her through it.',
    goals: ['Buy a nice coffee as a birthday gift for her son', 'Be sure she is not being charged extra'],
    frustrations: ['Pop-ups', 'Being made to create accounts and passwords', 'Error messages she cannot understand'],
  },
  {
    id: 'dev',
    initials: 'DP',
    color: '#0891b2',
    name: 'Dev Patel',
    age: 29,
    device: 'desktop' as const,
    tech_savviness: 'high' as const,
    reading_style: 'skims' as const,
    patience_steps: 28,
    bio: '29, product designer at a fintech startup in Austin. Buys specialty coffee monthly and has strong opinions about checkout flows.',
    goals: ['Reorder coffee in under two minutes', 'Check out as a guest'],
    frustrations: ['Dark patterns', 'Hidden fees at the last step', 'Forms that reject valid input'],
  },
  {
    id: 'sofia',
    initials: 'SR',
    color: '#dc2626',
    name: 'Sofia Ramirez',
    age: 41,
    device: 'mobile' as const,
    tech_savviness: 'medium' as const,
    reading_style: 'skims' as const,
    patience_steps: 20,
    bio: '41, ER nurse and mother of two in Phoenix. Shops on her phone during short breaks and abandons anything that takes more than a few minutes.',
    goals: ['Get coffee ordered before her break ends'],
    frustrations: ['Tiny tap targets', 'Long multi-page forms on a phone', 'Anything that makes her start over'],
  },
];

const SAVVY_LABEL: Record<string, string> = { low: 'low tech', medium: 'medium tech', high: 'high tech' };

export default function Personas() {
  const { c } = useTheme();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 9, color: c.text5, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>PERSONAS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.03em' }}>Your personas</h1>
          <p style={{ color: c.text3, fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 }}>Each one is a distinct person — their own device, pace, and digital confidence.</p>
        </div>
        <button className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>+ Generate with AI</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {PERSONAS.map(p => (
          <Link key={p.id} to={`/personas/${p.id}`} style={{ textDecoration: 'none' }}>
            <div
              className="card-glass"
              style={{ padding: 22, cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s', borderRadius: 12 }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: p.color, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff',
                  boxShadow: `0 0 14px ${p.color}44`,
                }}>{p.initials}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text, letterSpacing: '-0.01em' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: c.text3, marginTop: 1 }}>{p.age} · {p.device}</div>
                </div>
              </div>

              <p style={{ fontSize: 12, color: c.text2, lineHeight: 1.65, margin: '0 0 14px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.bio}</p>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <Tag c={c}>{SAVVY_LABEL[p.tech_savviness]}</Tag>
                <Tag c={c}>{p.reading_style === 'reads_everything' ? 'reads everything' : 'skims'}</Tag>
                <Tag c={c}>{p.patience_steps} steps</Tag>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card-glass" style={{ padding: '28px 32px', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.text, marginBottom: 3 }}>Need more personas?</div>
          <div style={{ fontSize: 12, color: c.text3 }}>Describe your audience and the AI will generate a contrasting panel of realistic people.</div>
        </div>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '8px 16px', whiteSpace: 'nowrap', marginLeft: 24 }}>Generate personas →</button>
      </div>
    </div>
  );
}

function Tag({ children, c }: { children: React.ReactNode; c: { text3: string } }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--glass-bg)', color: c.text3, border: '1px solid var(--glass-border)' }}>
      {children}
    </span>
  );
}
