import { Link } from 'react-router';
import { useTheme } from '../context/ThemeContext';

const TESTS = [
  { id: 't1', name: 'Checkout: clean vs redesign',                  personas: 'Dev · Margaret · Sofia', date: '19 Sept, 14:30', status: 'finished', agents: 6, completed: 6, verdict: 'No clear winner', confidence: 'high', sentiment: 85 },
  { id: 't2', name: 'Checkout: clean vs dark patterns',             personas: 'James · Noah',           date: '19 Sept, 14:24', status: 'finished', agents: 4, completed: 3, verdict: 'A wins',           confidence: 'high', sentiment: 68 },
  { id: 't3', name: 'Coffee shop: dark patterns vs redesign',       personas: '6 agents',               date: '19 Sept, 13:57', status: 'finished', agents: 6, completed: null, verdict: 'C wins',         confidence: 'high', sentiment: null },
  { id: 't4', name: 'Coffee shop: clean vs dark patterns',          personas: '2 agents',               date: '19 Sept, 13:48', status: 'finished', agents: 2, completed: null, verdict: 'A wins',          confidence: 'low',  sentiment: null },
  { id: 't5', name: 'Coffee shop: clean vs dark patterns (re-run)', personas: '4 agents',               date: '19 Sept, 13:35', status: 'finished', agents: 4, completed: null, verdict: 'A wins',          confidence: 'high', sentiment: null },
];

const STATUS_STYLE = {
  finished: { bg: 'rgba(74,222,128,0.1)',  color: '#16a34a',  darkColor: '#4ade80', label: 'finished' },
  running:  { bg: 'rgba(96,165,250,0.1)',  color: '#2563eb',  darkColor: '#60a5fa', label: 'running'  },
  starting: { bg: 'rgba(250,204,21,0.1)',  color: '#ca8a04',  darkColor: '#facc15', label: 'starting' },
} as const;

const VERDICT_COLOR: Record<string, string> = {
  'A wins': '#16a34a', 'B wins': '#2563eb', 'C wins': '#7c3aed', 'No clear winner': '#6b7280',
};
const VERDICT_COLOR_DARK: Record<string, string> = {
  'A wins': '#4ade80', 'B wins': '#60a5fa', 'C wins': '#a78bfa', 'No clear winner': '#9ca3af',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Workspace() {
  const { theme, c } = useTheme();

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: c.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', marginBottom: 4 }}>
            {greeting()}, polypersona
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.03em' }}>Your tests</h1>
        </div>
        <Link to="/tests/new" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>New test</button>
        </Link>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
          { label: 'Tests run',      value: '5',   sub: 'all finished'          },
          { label: 'Agents run',     value: '22',  sub: 'each in its own tab'   },
          { label: 'Avg completion', value: '88%', sub: 'across finished tests' },
          { label: 'Clear winners',  value: '4',   sub: 'of 5 tests decided'    },
        ].map(s => (
          <div key={s.label} className="card-glass" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 10, color: c.text3, marginBottom: 10, letterSpacing: '0.02em' }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.text, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: c.text4, marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 60px 60px 128px 136px', gap: 20, padding: '0 20px 8px' }}>
        {['Test', 'Status', 'Agents', 'Done', 'Verdict', 'Sentiment'].map(h => (
          <div key={h} style={{ fontSize: 10, color: c.text4, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TESTS.map(t => {
          const st = STATUS_STYLE[t.status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.finished;
          const vc = theme === 'dark' ? (VERDICT_COLOR_DARK[t.verdict] ?? '#9ca3af') : (VERDICT_COLOR[t.verdict] ?? '#6b7280');
          const stColor = theme === 'dark' ? st.darkColor : st.color;
          return (
            <Link key={t.id} to={`/tests/${t.id}`} style={{ textDecoration: 'none' }}>
              <div
                className="card-glass"
                style={{ padding: '13px 20px', display: 'grid', gridTemplateColumns: '1fr 76px 60px 60px 128px 136px', alignItems: 'center', gap: 20, cursor: 'pointer', transition: 'background 0.15s', borderRadius: 9 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: c.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: c.text4 }}>{t.personas} · {t.date}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 4, background: st.bg, color: stColor, whiteSpace: 'nowrap', display: 'inline-block' }}>{st.label}</span>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: c.text, textAlign: 'center' }}>{t.agents}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: t.completed !== null ? c.text : c.text5, textAlign: 'center' }}>{t.completed ?? '—'}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: vc, whiteSpace: 'nowrap' }}>{t.verdict}</div>
                  <div style={{ fontSize: 10, color: c.text4, marginTop: 1 }}>{t.confidence} confidence</div>
                </div>
                <div>
                  {t.sentiment !== null ? (
                    <>
                      <div className="progress-bar" style={{ height: 3, marginBottom: 4 }}>
                        <div className="progress-fill" style={{ width: `${t.sentiment}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: c.accent, fontFamily: 'JetBrains Mono, monospace' }}>{t.sentiment}%</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: c.text5 }}>n/a</div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
