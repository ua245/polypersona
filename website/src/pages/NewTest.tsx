import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTheme } from '../context/ThemeContext';

const PERSONAS = [
  { id: 'margaret', initials: 'ME', color: '#ca8a04', name: 'Margaret Ellis', desc: '68 · desktop · low · reads everything' },
  { id: 'dev',      initials: 'DP', color: '#0891b2', name: 'Dev Patel',       desc: '29 · desktop · high · skims'          },
  { id: 'sofia',    initials: 'SR', color: '#dc2626', name: 'Sofia Ramirez',   desc: '41 · mobile · medium · skims'         },
];

const PRESETS = [
  {
    key: 'ab',
    tag: 'DEMO SHOP · A VS B',
    label: 'Clean vs dark patterns',
    desc: 'A clean guest checkout against one with a popup, forced account, a hidden fee and a real bug.',
    goal: 'Buy one 250g bag of Ethiopia Yirgacheffe coffee and have it shipped to your home.',
  },
  {
    key: 'ac',
    tag: 'DEMO SHOP · A VS C',
    label: 'Clean vs redesign',
    desc: 'A subtler call: a faster redesign that pre-ticks a subscription.',
    goal: 'Buy one 250g bag of Ethiopia Yirgacheffe coffee and have it shipped to your home.',
  },
  {
    key: 'custom',
    tag: 'ANY TWO URLS',
    label: 'Your own site',
    desc: 'Point the panel at two live URLs and tell them what to try.',
    goal: '',
  },
];

export default function NewTest() {
  const [preset, setPreset] = useState('ab');
  const [selectedPersonas, setSelectedPersonas] = useState(['margaret', 'dev', 'sofia']);
  const [name, setName] = useState('Checkout: clean vs dark patterns');
  const navigate = useNavigate();
  const { c } = useTheme();

  const selectedPreset = PRESETS.find(p => p.key === preset)!;

  function togglePersona(id: string) {
    setSelectedPersonas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const steps = [
    { label: 'What to compare', value: selectedPreset.label, done: true },
    { label: 'Who tests it',    value: PERSONAS.filter(p => selectedPersonas.includes(p.id)).map(p => p.name.split(' ')[0]).join(', ') || 'None selected', done: selectedPersonas.length > 0 },
    { label: 'Name',            value: name, done: !!name },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 'calc(100vh - 48px)' }}>
      {/* Sidebar */}
      <div className="sidebar-glass" style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 9, color: c.text5, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>NEW TEST</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>Set up your test</h2>
        <p style={{ fontSize: 12, color: c.text3, lineHeight: 1.7, margin: '0 0 24px' }}>
          Each persona uses both variants in a real browser, thinking out loud.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < steps.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
              <div style={{
                width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: s.done ? 'rgba(74,222,128,0.12)' : 'transparent',
                border: `1.5px solid ${s.done ? '#4ade80' : 'var(--glass-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{s.label}</div>
                <div style={{ fontSize: 10, color: c.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button
            className="btn-primary"
            onClick={() => navigate('/tests/live')}
            disabled={selectedPersonas.length === 0 || !name}
            style={{ fontSize: 13, padding: '10px', width: '100%', opacity: (selectedPersonas.length === 0 || !name) ? 0.35 : 1 }}
          >
            Start test →
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ padding: '36px 48px', overflowY: 'auto' }}>
        {/* Step 1 */}
        <div style={{ marginBottom: 44 }}>
          <StepHeader n={1} label="What to compare" c={c} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => { setPreset(p.key); setName(`Checkout: ${p.label.toLowerCase()}`); }}
                style={{
                  background: preset === p.key ? 'rgba(74,222,128,0.06)' : 'var(--glass-bg)',
                  border: `1.5px solid ${preset === p.key ? 'rgba(74,222,128,0.4)' : 'var(--glass-border)'}`,
                  borderRadius: 9, padding: '16px', textAlign: 'left', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 9, color: c.text3, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>{p.tag}</span>
                  <div style={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid ${preset === p.key ? '#4ade80' : 'var(--glass-border)'}`, background: preset === p.key ? '#4ade80' : 'transparent', flexShrink: 0, transition: 'all 0.15s' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 5 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: c.text3, lineHeight: 1.6 }}>{p.desc}</div>
              </button>
            ))}
          </div>
          {selectedPreset.goal && (
            <div style={{ fontSize: 11, color: c.text3, padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: 6, border: '1px solid var(--glass-border)' }}>
              <span style={{ color: c.text4 }}>Goal: </span>{selectedPreset.goal}
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <StepHeader n={2} label="Who tests it" c={c} />
            <span style={{ fontSize: 11, color: c.text3 }}>{selectedPersonas.length} of {PERSONAS.length} selected</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {PERSONAS.map(p => {
              const selected = selectedPersonas.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePersona(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: selected ? 'rgba(74,222,128,0.05)' : 'var(--glass-bg)',
                    border: `1.5px solid ${selected ? 'rgba(74,222,128,0.3)' : 'var(--glass-border)'}`,
                    borderRadius: 9, padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{p.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: c.text3 }}>{p.desc}</div>
                  </div>
                  <div style={{ width: 17, height: 17, borderRadius: '50%', border: `1.5px solid ${selected ? '#4ade80' : 'var(--glass-border)'}`, background: selected ? '#4ade80' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {selected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#071810" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                  </div>
                </button>
              );
            })}
          </div>
          <Link to="/personas" style={{ fontSize: 12, color: c.accent, textDecoration: 'none', opacity: 0.8 }}>
            Generate more personas with AI →
          </Link>
        </div>

        {/* Step 3 */}
        <div>
          <StepHeader n={3} label="Name this test" c={c} />
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ maxWidth: 520 }}
            placeholder="e.g. Checkout: clean vs dark patterns"
          />
        </div>
      </div>
    </div>
  );
}

function StepHeader({ n, label, c }: { n: number; label: string; c: { text: string; accent: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 11, color: c.accent, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', width: 14, textAlign: 'center' }}>{n}</span>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: c.text, margin: 0, letterSpacing: '-0.015em' }}>{label}</h3>
    </div>
  );
}
