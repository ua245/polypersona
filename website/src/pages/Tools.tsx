import { useState } from 'react';
import { useNavigate } from 'react-router';

type Step = 'setup' | 'creating' | 'monitor';

const AGENTS_TOTAL = 2438;

function TestSetup({ onStart }: { onStart: () => void }) {
  const [testName, setTestName] = useState('Testing case');
  const [websiteUrl, setWebsiteUrl] = useState('https://staging.northstartrading.co.uk');
  const [instructions, setInstructions] = useState('Choose standard delivery and complete the guest checkout. Use your own judgement when choosing colour and delivery.');
  const [success, setSuccess] = useState('Order confirmation page reached and order reference captured');
  const [optional, setOptional] = useState('Pay attention to delivery choice and promotional code messaging.');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 48px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>TEST SETUP · STEP 1 OF 4</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Define the testing case</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>
            Write brief agent the task objective and criteria, and the context needed to act independently.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {['Access and events', 'Instructions', 'Reviews'].map((s, i) => (
              <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? 'rgba(74,222,128,0.15)' : '#09090e',
                  border: `1px solid ${i === 0 ? '#4ade80' : '#1e2230'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i === 0 && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: 12, color: i === 0 ? '#e8eaf0' : '#4b5563' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Testing case</label>
            <input className="input" value={testName} onChange={e => setTestName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Website link</label>
            <input className="input" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Required logins</label>
              <input className="input" value="None — Guest Checkout" readOnly />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Asset uploads</label>
              <input className="input" value="checkout_test.pdf — 2.4 MB" readOnly />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Instructions</label>
            <textarea
              className="input"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Success criteria</label>
            <input className="input" value={success} onChange={e => setSuccess(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Optional notes</label>
            <input className="input" value={optional} onChange={e => setOptional(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button className="btn-secondary">Back</button>
            <button className="btn-primary" onClick={onStart}>Next: review and start →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatingAgents({ onDone }: { onDone: () => void }) {
  const [progress] = useState(70);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 48px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>ORCHESTRATION</div>
      <h1 style={{ fontSize: 36, fontWeight: 700, color: '#e8eaf0', letterSpacing: '-0.03em', margin: '0 0 12px' }}>
        Creating 2,438 sandboxed agents
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 48px' }}>
        Each identity and environment is isolated, reviewed, checked and assigned the same testing case.
      </p>

      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: '#4ade80', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', marginBottom: 4 }}>
          1,706
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>agents today of 2,438</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="tag-green" style={{ fontSize: 10 }}>70% complete</div>
        </div>
        <div style={{ fontSize: 12, color: '#facc15' }}>Takes 2 minutes remaining</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Validating data', status: 'complete' },
          { label: 'Creating identities', status: 'complete' },
          { label: 'Preparing announcements', status: 'active' },
          { label: 'Preparing testing case', status: 'pending' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: s.status === 'complete' ? '#4ade80' : s.status === 'active' ? '#facc15' : '#4b5563', marginBottom: 4 }}>
              {s.status === 'complete' ? '✓ Complete' : s.status === 'active' ? '◉ In progress' : '○ Pending'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'left', marginBottom: 40 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 12 }}>Live activity</div>
          {[
            'Concurrences — 5 504 people',
            'Identity points — 1 297 generated, 12',
            'Agents launched — 1 707 agents, 11',
            'Privacy boundary resolved →',
          ].map((line, i) => (
            <div key={i} style={{ fontSize: 11, color: '#6b7280', padding: '4px 0', borderBottom: i < 3 ? '1px solid #111318' : 'none' }}>• {line}</div>
          ))}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 12 }}>Operational safeguards</div>
          {[
            'Unlimited timeouts are active',
            'Collected cross-site isolated',
            'Screen shots enabled',
            'Safety recalling enabled',
          ].map((line, i) => (
            <div key={i} style={{ fontSize: 11, color: '#4b5563', padding: '4px 0', borderBottom: i < 3 ? '1px solid #111318' : 'none' }}>✓ {line}</div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={onDone} style={{ padding: '12px 32px', fontSize: 14 }}>
        View live journey monitor →
      </button>
    </div>
  );
}

const STEP_DEFS = [
  {
    key: 'login', label: 'Login',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="4" stroke={c} strokeWidth="1.8"/>
        <path d="M3 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    actions: ['Signing in as guest', 'Entering email address', 'Bypassing login screen', 'Loading guest session'],
  },
  {
    key: 'browse', label: 'Browse',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="10" cy="10" r="6" stroke={c} strokeWidth="1.8"/>
        <path d="M15 15l4 4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    actions: ['Searching for products', 'Filtering by category', 'Scrolling results', 'Comparing items'],
  },
  {
    key: 'product', label: 'Product',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="16" height="16" rx="2" stroke={c} strokeWidth="1.8"/>
        <path d="M7 11h8M11 7v8" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    actions: ['Reading product details', 'Checking size guide', 'Viewing images', 'Reading reviews'],
  },
  {
    key: 'basket', label: 'Basket',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M2 4h2l2.5 9h11l2-6H7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="17" r="1.5" fill={c}/>
        <circle cx="16" cy="17" r="1.5" fill={c}/>
      </svg>
    ),
    actions: ['Adding to basket', 'Reviewing basket', 'Updating quantity', 'Proceeding to checkout'],
  },
  {
    key: 'address', label: 'Address',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 2C7.7 2 5 4.7 5 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" stroke={c} strokeWidth="1.8"/>
        <circle cx="11" cy="8" r="2" fill={c}/>
      </svg>
    ),
    actions: ['Entering delivery address', 'Using address lookup', 'Selecting from saved', 'Confirming postcode'],
  },
  {
    key: 'payment', label: 'Payment',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="5" width="18" height="13" rx="2" stroke={c} strokeWidth="1.8"/>
        <path d="M2 9h18" stroke={c} strokeWidth="1.8"/>
        <path d="M6 14h4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    actions: ['Entering card details', 'Selecting payment method', 'Processing payment', 'Applying promo code'],
  },
  {
    key: 'confirm', label: 'Confirm',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.8"/>
        <path d="M7 11l3 3 5-5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    actions: ['Order confirmed', 'Viewing receipt', 'Copying order ref', 'Checking delivery date'],
  },
];

const STATUS_PALETTE = {
  active:    { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.22)',  icon: '#4ade80', dot: '#4ade80', label: 'Active'    },
  hesitating:{ bg: 'rgba(250,204,21,0.08)',  border: 'rgba(250,204,21,0.22)',  icon: '#facc15', dot: '#facc15', label: 'Hesitating'},
  blocked:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.22)', icon: '#f87171', dot: '#f87171', label: 'Blocked'   },
  done:      { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)',  icon: '#60a5fa', dot: '#60a5fa', label: 'Done'      },
};

type AgentStatus = keyof typeof STATUS_PALETTE;

function seedRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildAgents() {
  return Array.from({ length: 100 }, (_, i) => {
    const rand = seedRand(i * 37 + 7);
    const stepIdx = Math.floor(rand() * 7);
    const step = STEP_DEFS[stepIdx];
    const actionIdx = Math.floor(rand() * step.actions.length);
    const r = rand();
    const status: AgentStatus = i >= 90 ? 'done' : r > 0.88 ? 'blocked' : r > 0.76 ? 'hesitating' : 'active';
    const progress = Math.round(rand() * 40 + (stepIdx / 6) * 60);
    return {
      id: `A${String(i + 1).padStart(3, '0')}`,
      step,
      action: step.actions[actionIdx],
      status,
      progress,
    };
  });
}

const AGENTS = buildAgents();

function AgentTile({ agent, onClick }: { agent: typeof AGENTS[0]; onClick: () => void }) {
  const pal = STATUS_PALETTE[agent.status];
  return (
    <div
      onClick={onClick}
      style={{
        background: pal.bg,
        border: `1px solid ${pal.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 110,
        transition: 'border-color 0.15s, background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = pal.dot; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = pal.border; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{agent.id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: pal.dot }} />
          <span style={{ fontSize: 9, color: pal.dot, fontWeight: 500 }}>{pal.label}</span>
        </div>
      </div>

      {/* Icon + step */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {agent.step.icon(pal.icon)}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#e8eaf0', lineHeight: 1.2 }}>{agent.step.label}</div>
          <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.4, marginTop: 2 }}>{agent.action}</div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginTop: 'auto' }}>
        <div className="progress-bar" style={{ height: 2 }}>
          <div className="progress-fill" style={{ width: `${agent.progress}%`, background: pal.dot }} />
        </div>
      </div>
    </div>
  );
}

function JourneyMonitorInline() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all');

  const visible = filter === 'all' ? AGENTS : AGENTS.filter(a => a.status === filter);

  const counts = {
    active:     AGENTS.filter(a => a.status === 'active').length,
    hesitating: AGENTS.filter(a => a.status === 'hesitating').length,
    blocked:    AGENTS.filter(a => a.status === 'blocked').length,
    done:       AGENTS.filter(a => a.status === 'done').length,
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>LIVE TEST · SCANNING AGENTS</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8eaf0', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Checkout journey monitor</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>100 London agents operating in parallel on the staging environment</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary">Pause test</button>
          <button className="btn-primary" onClick={() => navigate('/insights')}>Open insights →</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active agents', value: counts.active,     color: '#e8eaf0', status: 'active'     as const },
          { label: 'Completed',     value: counts.done,       color: '#60a5fa', status: 'done'        as const },
          { label: 'Blocked',       value: counts.blocked,    color: '#f87171', status: 'blocked'     as const },
          { label: 'Hesitating',    value: counts.hesitating, color: '#facc15', status: 'hesitating'  as const },
        ].map(s => (
          <div
            key={s.label}
            className="card"
            onClick={() => setFilter(filter === s.status ? 'all' : s.status)}
            style={{ padding: 20, cursor: 'pointer', borderColor: filter === s.status ? s.color : undefined, transition: 'border-color 0.15s' }}
          >
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sentiment bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', flexShrink: 0 }}>Population sentiment</div>
        <div style={{ flex: 1 }}>
          <div className="progress-bar" style={{ height: 5 }}>
            <div className="progress-fill" style={{ width: '68%' }} />
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>68% positive</div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <button className={filter === 'all' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setFilter('all')}>All ({AGENTS.length})</button>
        {(['active','hesitating','blocked','done'] as const).map(s => (
          <button key={s} className={filter === s ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setFilter(filter === s ? 'all' : s)}>
            {STATUS_PALETTE[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Agent tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 8,
      }}>
        {visible.map(agent => (
          <AgentTile
            key={agent.id}
            agent={agent}
            onClick={() => navigate(`/populations/${agent.id}`)}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 16, textAlign: 'center' }}>
        Showing {visible.length} of 100 agents
      </div>
    </div>
  );
}

export default function Tools() {
  const [phase, setPhase] = useState<Step>('setup');

  if (phase === 'setup') return <TestSetup onStart={() => setPhase('creating')} />;
  if (phase === 'creating') return <CreatingAgents onDone={() => setPhase('monitor')} />;
  return <JourneyMonitorInline />;
}
