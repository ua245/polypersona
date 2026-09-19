import { Link } from 'react-router';

const journeys = [
  { name: 'Checkout Journey', population: 'London 100', status: 'live', agents: 63, completed: 18, blocked: 10, sentiment: 68 },
  { name: 'Onboarding Flow', population: 'SF Shoppers 50', status: 'completed', agents: 50, completed: 50, blocked: 3, sentiment: 82 },
  { name: 'Product Discovery', population: 'NYC Millennials 200', status: 'paused', agents: 200, completed: 141, blocked: 22, sentiment: 57 },
  { name: 'Support Portal', population: 'Global 75', status: 'setup', agents: 75, completed: 0, blocked: 0, sentiment: 0 },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    live: 'tag-green', completed: 'tag-blue', paused: 'tag-yellow', setup: 'tag-muted',
  };
  return <span className={`tag-green ${map[status]}`} style={{ fontSize: 10 }}>{status}</span>;
}

export default function Workspace() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Workspace</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', margin: 0, letterSpacing: '-0.02em' }}>Your journeys</h1>
        </div>
        <Link to="/populations/new" style={{ textDecoration: 'none' }}>
          <button className="btn-primary">New journey</button>
        </Link>
      </div>

      {/* Journey cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {journeys.map(j => (
          <Link key={j.name} to="/tools" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 32, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#252a38')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2230')}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 4 }}>{j.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{j.population}</div>
              </div>
              <StatusBadge status={j.status} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', fontFamily: 'JetBrains Mono, monospace' }}>{j.agents}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>agents</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', fontFamily: 'JetBrains Mono, monospace' }}>{j.completed}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>completed</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Sentiment</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${j.sentiment}%` }} /></div>
                <div style={{ fontSize: 10, color: '#4ade80', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>{j.sentiment}%</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32 }}>
        {[
          { label: 'Total agents run', value: '2,438', delta: '+12%' },
          { label: 'Avg. completion', value: '67%', delta: '+5%' },
          { label: 'Friction points found', value: '34', delta: '-8%' },
          { label: 'Journeys tested', value: '4', delta: '+1' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>{s.delta} this month</div>
          </div>
        ))}
      </div>
    </div>
  );
}
