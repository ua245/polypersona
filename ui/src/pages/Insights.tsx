import { useState } from 'react';

const sentimentThemes = [
  { theme: 'Friction at checkout', count: 34, sentiment: 'negative', pct: 34 },
  { theme: 'Fast search', count: 41, sentiment: 'positive', pct: 41 },
  { theme: 'Delivery confusion', count: 22, sentiment: 'negative', pct: 22 },
  { theme: 'Good product images', count: 58, sentiment: 'positive', pct: 58 },
  { theme: 'Unclear pricing', count: 15, sentiment: 'negative', pct: 15 },
];

const commonActions = [
  { action: 'Searched for product', count: 94, pct: 94 },
  { action: 'Added to basket', count: 88, pct: 88 },
  { action: 'Viewed delivery options', count: 81, pct: 81 },
  { action: 'Reached payment screen', count: 73, pct: 73 },
  { action: 'Completed checkout', count: 54, pct: 54 },
  { action: 'Used promo code', count: 12, pct: 12 },
];

const completionFunnel = [
  { label: 'Started journey', count: 100 },
  { label: 'Reached product page', count: 96 },
  { label: 'Added to basket', count: 88 },
  { label: 'Reached checkout', count: 78 },
  { label: 'Entered address', count: 67 },
  { label: 'Completed payment', count: 54 },
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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px' }}>
      <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        CHECKOUT JOURNEY · 100 LONDON AGENTS
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8eaf0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Population insights</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 32px' }}>Patterns from 54 completed, 33 active and 13 managed or queued sessions.</p>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Overall sentiment', value: '68%', tag: 'Good', color: '#4ade80' },
          { label: 'Completion rate', value: '18%', tag: 'Low', color: '#f87171' },
          { label: 'Avg. time to complete', value: '12m 42s', tag: null, color: '#e8eaf0' },
          { label: 'Friction rate', value: '4%', tag: 'Watch', color: '#facc15' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{s.value}</div>
              {s.tag && <span className={`tag-green ${s.color === '#4ade80' ? '' : s.color === '#f87171' ? 'tag-red' : 'tag-yellow'}`} style={{ fontSize: 9 }}>{s.tag}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sentiment themes */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Leading themes</div>
            {sentimentThemes.map(t => (
              <div key={t.theme}
                onClick={() => setSelectedTheme(selectedTheme === t.theme ? null : t.theme)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #111318', cursor: 'pointer' }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.sentiment === 'positive' ? '#4ade80' : '#f87171', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#e8eaf0', flex: 1 }}>{t.theme}</span>
                <MiniBar pct={t.pct} color={t.sentiment === 'positive' ? '#4ade80' : '#f87171'} />
                <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', width: 24, textAlign: 'right' }}>{t.count}</span>
              </div>
            ))}
          </div>

          {/* Common actions */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Common actions</div>
            {commonActions.map(a => (
              <div key={a.action} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #111318' }}>
                <span style={{ fontSize: 12, color: '#9ca3af', flex: 1 }}>{a.action}</span>
                <MiniBar pct={a.pct} />
                <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', width: 28, textAlign: 'right' }}>{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Key finding */}
          <div className="card" style={{ padding: 20, border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.03)' }}>
            <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 8, fontWeight: 600 }}>40 AGENTS · KEY FINDING</div>
            <p style={{ fontSize: 13, color: '#e8eaf0', lineHeight: 1.7, margin: '0 0 12px' }}>
              Product discovery is working well, but the checkout loses confidence when delivery cost first appears. Address lookup is the only hard blocker. Make delivery pricing visible before checkout and still manual address entry and manual address data.
            </p>
            <div className="tag-green" style={{ fontSize: 10, display: 'inline-flex' }}>2 agents Blocked</div>
          </div>

          {/* Notable alerts */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 12 }}>Notable alerts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '8px 10px', background: 'rgba(248,113,113,0.07)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 2 }}>2 agents blocked</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Payment step — these agents are blocked on the delivery step</div>
              </div>
              <div style={{ padding: '8px 10px', background: 'rgba(250,204,21,0.07)', borderRadius: 6, border: '1px solid rgba(250,204,21,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#facc15', marginBottom: 2 }}>1 Delivery blocked</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Multiple agents are blocked on this delivery flow</div>
              </div>
            </div>
          </div>

          {/* Completion funnel */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 16 }}>Completion funnel</div>
            {completionFunnel.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #111318' }}>
                <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', width: 14 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: '#9ca3af', flex: 1 }}>{step.label}</span>
                <MiniBar pct={step.count} />
                <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', width: 28, textAlign: 'right' }}>{step.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
