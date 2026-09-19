import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const sentimentThemes = [
  { theme: 'Friction at checkout',  count: 34, sentiment: 'negative', pct: 34 },
  { theme: 'Fast search',           count: 41, sentiment: 'positive', pct: 41 },
  { theme: 'Delivery confusion',    count: 22, sentiment: 'negative', pct: 22 },
  { theme: 'Good product images',   count: 58, sentiment: 'positive', pct: 58 },
  { theme: 'Unclear pricing',       count: 15, sentiment: 'negative', pct: 15 },
];

const commonActions = [
  { action: 'Searched for product',   count: 94, pct: 94 },
  { action: 'Added to basket',        count: 88, pct: 88 },
  { action: 'Viewed delivery options',count: 81, pct: 81 },
  { action: 'Reached payment screen', count: 73, pct: 73 },
  { action: 'Completed checkout',     count: 54, pct: 54 },
  { action: 'Used promo code',        count: 12, pct: 12 },
];

const completionFunnel = [
  { label: 'Started journey',       count: 100 },
  { label: 'Reached product page',  count: 96 },
  { label: 'Added to basket',       count: 88 },
  { label: 'Reached checkout',      count: 78 },
  { label: 'Entered address',       count: 67 },
  { label: 'Completed payment',     count: 54 },
];

function MiniBar({ pct, color = '#4ade80' }: { pct: number; color?: string }) {
  return (
    <div className="progress-bar" style={{ flex: 1 }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function Insights() {
  const [selectedTheme, setSelectedTheme] = useState<null | string>(null);
  const { theme, c } = useTheme();

  const posColor = theme === 'dark' ? '#4ade80' : '#16a34a';
  const negColor = '#f87171';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px' }}>
      <div style={{ fontSize: 10, color: c.text4, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        CHECKOUT JOURNEY · 100 LONDON AGENTS
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Population insights</h1>
      <p style={{ fontSize: 13, color: c.text3, margin: '0 0 32px' }}>Patterns from 54 completed, 33 active and 13 managed or queued sessions.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Overall sentiment',    value: '68%',     tag: 'Good',  tagClass: 'tag-green',  color: posColor },
          { label: 'Completion rate',      value: '18%',     tag: 'Low',   tagClass: 'tag-red',    color: '#f87171' },
          { label: 'Avg. time to complete',value: '12m 42s', tag: null,    tagClass: '',           color: c.text },
          { label: 'Friction rate',        value: '4%',      tag: 'Watch', tagClass: 'tag-yellow', color: theme === 'dark' ? '#facc15' : '#ca8a04' },
        ].map(s => (
          <div key={s.label} className="card-glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: c.text3, marginBottom: 8 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{s.value}</div>
              {s.tag && <span className={s.tagClass} style={{ fontSize: 9 }}>{s.tag}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 16 }}>Leading themes</div>
            {sentimentThemes.map(t => (
              <div key={t.theme}
                onClick={() => setSelectedTheme(selectedTheme === t.theme ? null : t.theme)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.sentiment === 'positive' ? posColor : negColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: c.text, flex: 1 }}>{t.theme}</span>
                <MiniBar pct={t.pct} color={t.sentiment === 'positive' ? posColor : negColor} />
                <span style={{ fontSize: 11, color: c.text3, fontFamily: 'JetBrains Mono, monospace', width: 24, textAlign: 'right' }}>{t.count}</span>
              </div>
            ))}
          </div>

          <div className="card-glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 16 }}>Common actions</div>
            {commonActions.map(a => (
              <div key={a.action} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: 12, color: c.text2, flex: 1 }}>{a.action}</span>
                <MiniBar pct={a.pct} />
                <span style={{ fontSize: 11, color: c.text3, fontFamily: 'JetBrains Mono, monospace', width: 28, textAlign: 'right' }}>{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-glass" style={{ padding: 20, border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.03)' }}>
            <div style={{ fontSize: 11, color: c.accent, marginBottom: 8, fontWeight: 600 }}>40 AGENTS · KEY FINDING</div>
            <p style={{ fontSize: 13, color: c.text, lineHeight: 1.7, margin: '0 0 12px' }}>
              Product discovery is working well, but the checkout loses confidence when delivery cost first appears. Address lookup is the only hard blocker. Make delivery pricing visible before checkout and fix manual address entry.
            </p>
            <div className="tag-green" style={{ fontSize: 10, display: 'inline-flex' }}>2 agents blocked</div>
          </div>

          <div className="card-glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12 }}>Notable alerts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '8px 10px', background: 'rgba(248,113,113,0.07)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 2 }}>2 agents blocked</div>
                <div style={{ fontSize: 11, color: c.text3 }}>Payment step — these agents are blocked on the delivery step</div>
              </div>
              <div style={{ padding: '8px 10px', background: 'rgba(250,204,21,0.07)', borderRadius: 6, border: '1px solid rgba(250,204,21,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme === 'dark' ? '#facc15' : '#ca8a04', marginBottom: 2 }}>1 Delivery blocked</div>
                <div style={{ fontSize: 11, color: c.text3 }}>Multiple agents are blocked on this delivery flow</div>
              </div>
            </div>
          </div>

          <div className="card-glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 16 }}>Completion funnel</div>
            {completionFunnel.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: 10, color: c.text4, fontFamily: 'JetBrains Mono, monospace', width: 14 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: c.text2, flex: 1 }}>{step.label}</span>
                <MiniBar pct={step.count} />
                <span style={{ fontSize: 11, color: c.text3, fontFamily: 'JetBrains Mono, monospace', width: 28, textAlign: 'right' }}>{step.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
