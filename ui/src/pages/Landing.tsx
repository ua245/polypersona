import { Link } from 'react-router';

const GRID_COLORS = [
  '#16a34a','#15803d','#4ade80','#86efac','#dcfce7',
  '#ca8a04','#a16207','#facc15','#fde047','#fef9c3',
  '#dc2626','#b91c1c','#f87171','#fca5a5','#fee2e2',
  '#2563eb','#1d4ed8','#60a5fa','#93c5fd','#dbeafe',
  '#7c3aed','#6d28d9','#a78bfa','#c4b5fd','#ede9fe',
  '#0891b2','#0e7490','#22d3ee','#67e8f9','#cffafe',
];

function AgentGrid() {
  const cells: string[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 10; c++) {
      const i = r * 10 + c;
      if (i < 87) {
        cells.push(GRID_COLORS[Math.floor(Math.random() * GRID_COLORS.length) * 0 + (i % GRID_COLORS.length)]);
      } else {
        cells.push('');
      }
    }
  }

  const fixed = [
    '#4ade80','#22c55e','#86efac','#4ade80','#16a34a','#4ade80','#22c55e','#4ade80','#86efac','#16a34a',
    '#ca8a04','#facc15','#ca8a04','#a16207','#facc15','#ca8a04','#facc15','#ca8a04','#a16207','#facc15',
    '#dc2626','#f87171','#dc2626','#b91c1c','#f87171','#dc2626','#f87171','#dc2626','#b91c1c','#f87171',
    '#2563eb','#60a5fa','#2563eb','#1d4ed8','#60a5fa','#2563eb','#60a5fa','#2563eb','#1d4ed8','#60a5fa',
    '#7c3aed','#a78bfa','#7c3aed','#6d28d9','#a78bfa','#7c3aed','#a78bfa','#7c3aed','#6d28d9','#a78bfa',
    '#0891b2','#22d3ee','#0891b2','#0e7490','#22d3ee','#0891b2','#22d3ee','#0891b2','#0e7490','#22d3ee',
    '#4ade80','#22c55e','#4ade80','#16a34a','#86efac','#4ade80','#22c55e','#4ade80','#16a34a','#86efac',
    '#ca8a04','#facc15','#ca8a04','#facc15','#a16207','#ca8a04','','','','',
    '#dc2626','#f87171','#dc2626','#f87171','#b91c1c','','','','','',
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 22px)',
      gridTemplateRows: 'repeat(9, 22px)',
      gap: 3,
      opacity: 0.85,
    }}>
      {fixed.map((color, i) => (
        <div key={i} style={{
          width: 22, height: 22, borderRadius: 4,
          background: color || 'transparent',
          border: color ? 'none' : 'none',
          opacity: color ? 1 : 0,
        }} />
      ))}
    </div>
  );
}

function CheckoutJourneyPreview() {
  const rows = [
    { status: 'g', cols: ['g','g','g','g','g','g','r','g','g','g','g','g','g'] },
    { status: 'g', cols: ['g','g','g','g','g','g','g','g','g','g','g','g','g'] },
    { status: 'y', cols: ['g','g','g','g','g','g','g','g','g','g','g','y',''] },
    { status: 'g', cols: ['g','g','g','g','g','g','g','g','g','g','g','g','g'] },
    { status: 'g', cols: ['g','g','g','g','g','g','g','g','r','g','g','g','g'] },
  ];

  const color: Record<string, string> = { g: '#4ade80', r: '#f87171', y: '#facc15', '': 'transparent' };
  const labels = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13'];

  return (
    <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 4, paddingLeft: 24 }}>
        {labels.map(l => <div key={l} style={{ width: 18, textAlign: 'center', fontSize: 8 }}>{l}</div>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
          <div style={{ width: 20, color: '#4b5563', fontSize: 9 }}>R{ri+1}</div>
          {row.cols.map((c, ci) => (
            <div key={ci} style={{
              width: 18, height: 14, borderRadius: 2,
              background: c ? color[c] : '#1e2230',
              opacity: c ? 1 : 0.3,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ background: '#09090e', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '80px 48px 60px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center',
      }}>
        <div>
          <div className="tag-green" style={{ marginBottom: 16, fontSize: 10 }}>
            <span className="dot-green" />
            AGENT POPULATION TESTING
          </div>
          <h1 style={{
            fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: '#e8eaf0',
            letterSpacing: '-0.03em', margin: '0 0 20px',
          }}>
            Build a population of sandboxed customer agents
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.7, margin: '0 0 36px', maxWidth: 460 }}>
            Test websites, journeys and ideas with realistic agent populations before launch. See where people succeed, hesitate and get blocked.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 48 }}>
            <Link to="/populations/new" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: 14, padding: '10px 22px' }}>Get started</button>
            </Link>
            <Link to="/workspace" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary" style={{ fontSize: 14, padding: '10px 22px' }}>See how it works</button>
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 32, color: '#4b5563', fontSize: 12 }}>
            <span>No credit card required</span>
            <span>Populations in minutes</span>
            <span>Privacy-first</span>
          </div>
        </div>

        {/* Right: dashboard preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}>Checkout Journey • London 100</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="tag-green" style={{ fontSize: 9 }}><span className="dot-green"/>Live</span>
                </div>
              </div>
            </div>
            <CheckoutJourneyPreview />
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
              <span>63 <span style={{ color: '#4b5563' }}>agents active</span></span>
              <span>18 <span style={{ color: '#4b5563' }}>completed</span></span>
              <span style={{ color: '#f87171' }}>10 blocked</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Population size</div>
              <AgentGrid />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>
                <span>72 agents active</span>
                <span>28% passed</span>
              </div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>Population sentiment</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: '#4ade80', letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>68%</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>positive</div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 6 }}>Completion</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '68%' }} /></div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 6 }}>Friction</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '18%', background: '#facc15' }} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ borderTop: '1px solid #1e2230', padding: '60px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
            {[
              { title: 'Parallel by default', body: 'Run hundreds of customers at once at any stage of your customer journey.' },
              { title: 'Observe every action', body: 'Inspect the sessions and events from every single agent in real time.' },
              { title: 'Decide with evidence', body: 'Turn patterns into clear actions based on real population-level data.' },
            ].map(f => (
              <div key={f.title}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 10 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
