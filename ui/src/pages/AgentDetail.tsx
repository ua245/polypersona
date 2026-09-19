import { useParams, Link } from 'react-router';
import { useState } from 'react';

const logEntries = [
  { ts: '14:03:21', msg: 'Navigated to checkout page', type: 'info' },
  { ts: '14:03:45', msg: 'Searched for "London next day delivery"', type: 'info' },
  { ts: '14:04:12', msg: 'Agent selected standard delivery — £4.99', type: 'action' },
  { ts: '14:04:55', msg: 'Hesitated on address entry field for 18s', type: 'warn' },
  { ts: '14:05:03', msg: 'Address auto-complete triggered, selected "14 Marlborough Rd"', type: 'action' },
  { ts: '14:05:41', msg: 'Paused at order summary for 32s', type: 'warn' },
  { ts: '14:06:02', msg: 'Clicked "Place order" button', type: 'action' },
  { ts: '14:06:05', msg: 'Payment processed — £79.00', type: 'success' },
];

const logColor: Record<string, string> = { info: '#6b7280', action: '#4ade80', warn: '#facc15', success: '#60a5fa' };

// Placeholder screenshots — wireframe-style illustration of a checkout page
function BrowserViewport({ requesting, onRequest }: { requesting: boolean; onRequest: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e2230' }}>
      {/* Browser chrome */}
      <div style={{ background: '#181b22', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1e2230' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f87171', opacity: 0.6 }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#facc15', opacity: 0.6 }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', opacity: 0.6 }} />
        </div>
        <div style={{
          flex: 1, background: '#09090e', borderRadius: 4, padding: '3px 10px',
          fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <circle cx="4.5" cy="4.5" r="3.5" stroke="#4b5563" strokeWidth="1"/>
            <path d="M4.5 2v2.5l1.5 1" stroke="#4b5563" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          staging.northstartrading.co.uk/checkout
        </div>
        <div style={{ fontSize: 9, color: '#4b5563' }}>Live</div>
      </div>

      {/* Viewport placeholder */}
      <div style={{
        background: '#0d0f14',
        minHeight: 280,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Skeleton of a checkout page */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {/* Fake site nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #1a1d26' }}>
            <div style={{ width: 80, height: 10, background: '#1e2230', borderRadius: 4 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[40, 48, 36].map((w, i) => <div key={i} style={{ width: w, height: 8, background: '#1a1d26', borderRadius: 4 }} />)}
            </div>
            <div style={{ width: 60, height: 24, background: '#252a38', borderRadius: 4 }} />
          </div>

          {/* Page title */}
          <div style={{ width: 160, height: 14, background: '#1e2230', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: 220, height: 9, background: '#1a1d26', borderRadius: 4, marginBottom: 24 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 20 }}>
            {/* Form area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: '100%', height: 32, background: '#181b22', borderRadius: 4, border: '1px solid #1e2230' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ height: 32, background: '#181b22', borderRadius: 4, border: '1px solid #1e2230' }} />
                <div style={{ height: 32, background: '#181b22', borderRadius: 4, border: '1px solid #1e2230' }} />
              </div>
              {/* Delivery options */}
              <div style={{ height: 42, background: '#181b22', borderRadius: 4, border: '1px solid #4ade80', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} />
                <div style={{ flex: 1, height: 8, background: '#252a38', borderRadius: 4 }} />
                <div style={{ width: 30, height: 8, background: '#4ade80', borderRadius: 4, opacity: 0.5 }} />
              </div>
              <div style={{ height: 42, background: '#181b22', borderRadius: 4, border: '1px solid #1e2230', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #252a38' }} />
                <div style={{ flex: 1, height: 8, background: '#1e2230', borderRadius: 4 }} />
                <div style={{ width: 30, height: 8, background: '#1e2230', borderRadius: 4 }} />
              </div>
              <div style={{ height: 36, background: '#4ade80', borderRadius: 4, opacity: 0.85, marginTop: 4 }} />
            </div>

            {/* Order summary */}
            <div style={{ background: '#181b22', borderRadius: 6, border: '1px solid #1e2230', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: 80, height: 9, background: '#252a38', borderRadius: 4 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 36, height: 36, background: '#252a38', borderRadius: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, background: '#252a38', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ width: '60%', height: 7, background: '#1e2230', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ borderTop: '1px solid #1e2230', paddingTop: 10 }}>
                {[['Subtotal', '£74.01'], ['Delivery', '£4.99'], ['Total', '£79.00']].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ width: 40, height: 7, background: '#1e2230', borderRadius: 4 }} />
                    <div style={{ width: 32, height: 7, background: l === 'Total' ? '#4ade80' : '#1e2230', borderRadius: 4, opacity: l === 'Total' ? 0.6 : 1 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Overlay: placeholder state */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(9,9,14,0.72)',
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 280 }}>
            <div style={{ marginBottom: 12 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ margin: '0 auto', display: 'block' }}>
                <rect x="4" y="8" width="28" height="20" rx="3" stroke="#4b5563" strokeWidth="1.5"/>
                <circle cx="18" cy="18" r="6" stroke="#4b5563" strokeWidth="1.5"/>
                <circle cx="18" cy="18" r="2" fill="#4b5563"/>
                <path d="M4 12h28" stroke="#4b5563" strokeWidth="1.5"/>
                <circle cx="7" cy="10" r="1" fill="#4b5563"/>
                <circle cx="10" cy="10" r="1" fill="#4b5563"/>
                <circle cx="13" cy="10" r="1" fill="#4b5563"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6 }}>
              Live screenshot
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, marginBottom: 16 }}>
              Connect the agent runtime to stream live screenshots of what this agent sees.
            </div>
            <button className="btn-secondary" style={{ fontSize: 11, width: '100%' }}>
              Request screenshot
            </button>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div style={{ background: '#111318', borderTop: '1px solid #1e2230', padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="dot-yellow" />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>Agent paused at address step · 14:04:55</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onRequest}
            style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4,
              background: requesting ? 'rgba(74,222,128,0.12)' : 'transparent',
              border: `1px solid ${requesting ? '#4ade80' : '#1e2230'}`,
              color: requesting ? '#4ade80' : '#6b7280',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1"/>
              <circle cx="4.5" cy="4.5" r="1.5" fill="currentColor"/>
            </svg>
            {requesting ? 'Recording requested' : 'Request recording'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SnapshotStrip() {
  const times = ['14:03:21', '14:04:12', '14:04:55', '14:05:41', '14:06:05'];
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {times.map((t, i) => (
        <div key={t} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            width: 90, height: 60,
            background: '#111318',
            borderRadius: 5, border: `1px solid ${i === 2 ? '#facc15' : '#1e2230'}`,
            position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* mini page skeleton */}
            <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 4, background: '#1e2230', borderRadius: 2 }} />
              <div style={{ height: 4, background: '#1e2230', borderRadius: 2, width: '70%' }} />
              <div style={{ height: 8, background: i === 2 ? 'rgba(250,204,21,0.2)' : '#181b22', borderRadius: 2, marginTop: 4, border: `1px solid ${i === 2 ? 'rgba(250,204,21,0.3)' : '#1e2230'}` }} />
              <div style={{ height: 8, background: '#181b22', borderRadius: 2 }} />
            </div>
            {i === 2 && (
              <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#facc15' }} />
            )}
            {/* Placeholder overlay icon */}
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(9,9,14,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="#4b5563" strokeWidth="1"/>
                <circle cx="7" cy="7" r="2.5" stroke="#4b5563" strokeWidth="1"/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>{t}</div>
        </div>
      ))}
      <div style={{
        flexShrink: 0, width: 90, height: 60, borderRadius: 5,
        border: '1px dashed #1e2230', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
        color: '#4b5563',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 9 }}>More</span>
      </div>
    </div>
  );
}

function nameFromId(id: string) {
  const names: Record<string, string> = {
    A001: 'Aisha Khan', A002: 'Tom Harris', A003: 'Macy Chadda',
  };
  return names[id] ?? `Agent ${id}`;
}

function initialsColor(id: string) {
  const colors = ['#16a34a','#0891b2','#7c3aed','#dc2626','#ca8a04'];
  const n = parseInt(id.replace('A',''), 10);
  return colors[n % colors.length];
}

export default function AgentDetail() {
  const { id } = useParams();
  const agentId = id ?? 'A001';
  const name = nameFromId(agentId);
  const [paused, setPaused] = useState(true);
  const [recordingRequested, setRecordingRequested] = useState(false);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Link to="/populations" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>← Populations</Link>
        <span style={{ color: '#1e2230' }}>·</span>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: initialsColor(agentId),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#fff',
        }}>
          {name.split(' ').map(w => w[0]).join('')}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{name}</span>
        <span style={{ color: '#4b5563', fontSize: 13 }}>·</span>
        <span style={{ color: '#6b7280', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{agentId}</span>
        <span className="tag-red" style={{ fontSize: 10 }}>Resolve</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setPaused(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn-primary">Stop agent</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Browser viewport */}
          <BrowserViewport
            requesting={recordingRequested}
            onRequest={() => setRecordingRequested(!recordingRequested)}
          />

          {/* Snapshot strip */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Snapshots</div>
              <button
                onClick={() => setRecordingRequested(!recordingRequested)}
                style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 4,
                  background: recordingRequested ? 'rgba(74,222,128,0.12)' : 'transparent',
                  border: `1px solid ${recordingRequested ? '#4ade80' : '#1e2230'}`,
                  color: recordingRequested ? '#4ade80' : '#6b7280',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                }}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1"/>
                  <circle cx="4.5" cy="4.5" r="1.5" fill="currentColor"/>
                </svg>
                {recordingRequested ? 'Recording requested' : 'Request screen recording'}
              </button>
            </div>
            <SnapshotStrip />
          </div>

          {/* Task progress */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              CHECKOUT JOURNEY · NORTHSTAR
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', margin: '6px 0 16px' }}>
              Choose standard delivery and complete the guest checkout
            </div>
            {[
              { label: 'Signed in as guest', done: true },
              { label: 'Searched for "London next day delivery"', done: true },
              { label: 'Selected standard delivery — £4.99', done: true },
              { label: 'Confirm basket items', done: false },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1e2230' }}>
                <div style={{
                  width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                  background: a.done ? 'rgba(74,222,128,0.15)' : 'transparent',
                  border: `1px solid ${a.done ? '#4ade80' : '#1e2230'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: 12, color: a.done ? '#e8eaf0' : '#4b5563' }}>{a.label}</span>
              </div>
            ))}
          </div>

          {/* Guide */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 6 }}>Guide this agent</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
              Use manual address entry and continue with the safest delivery choice.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ fontSize: 11 }}>Confirmation required</button>
              <button className="btn-primary" style={{ fontSize: 11 }}>Resume instructions</button>
            </div>
          </div>
        </div>

        {/* Right: inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot-yellow" />
              Live inspector
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event log</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {logEntries.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #0f1118' }}>
                  <span style={{ fontSize: 9, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, paddingTop: 2 }}>{entry.ts}</span>
                  <span style={{ fontSize: 11, color: logColor[entry.type] || '#6b7280', lineHeight: 1.5 }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 10 }}>Notable alerts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '8px 10px', background: 'rgba(248,113,113,0.07)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 2 }}>2 agents blocked</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Payment step — 3 agents are blocked on this journey</div>
              </div>
              <div style={{ padding: '8px 10px', background: 'rgba(250,204,21,0.07)', borderRadius: 6, border: '1px solid rgba(250,204,21,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#facc15', marginBottom: 2 }}>Delivery confusion</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Multiple agents are blocked on this delivery flow</div>
              </div>
            </div>
          </div>

          {/* Delivery form summary */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>Last captured form state</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Address</div>
                <div style={{ fontSize: 12, color: '#e8eaf0' }}>14 Marlborough Rd, London</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>First name</div>
                  <div style={{ fontSize: 12, color: '#e8eaf0' }}>Aisha</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Last name</div>
                  <div style={{ fontSize: 12, color: '#e8eaf0' }}>Khan</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #1e2230', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Standard delivery</span>
                <span style={{ fontSize: 11, color: '#4ade80', fontFamily: 'JetBrains Mono, monospace' }}>£4.99</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Order total</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', fontFamily: 'JetBrains Mono, monospace' }}>£79.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
