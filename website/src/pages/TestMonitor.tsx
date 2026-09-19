import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTheme } from '../context/ThemeContext';

const TEST_DATA: Record<string, { name: string; status: 'starting' | 'running' | 'finished'; agents: number; variantA: string; variantB: string }> = {
  live: { name: 'Checkout: clean vs dark patterns', status: 'starting',  agents: 0, variantA: 'clean checkout', variantB: 'dark patterns' },
  t1:   { name: 'Checkout: clean vs redesign',       status: 'finished', agents: 6, variantA: 'clean checkout', variantB: 'redesign'      },
  t2:   { name: 'Checkout: clean vs dark patterns',  status: 'running',  agents: 6, variantA: 'clean checkout', variantB: 'dark patterns' },
  t3:   { name: 'Coffee shop: dark patterns vs redesign', status: 'finished', agents: 6, variantA: 'clean checkout', variantB: 'dark patterns' },
  t4:   { name: 'Coffee shop: clean vs dark patterns',   status: 'finished', agents: 2, variantA: 'clean checkout', variantB: 'dark patterns' },
  t5:   { name: 'Coffee shop: clean vs dark patterns',   status: 'finished', agents: 4, variantA: 'clean checkout', variantB: 'dark patterns' },
};

const STATUS_COLORS: Record<string, { bg: string; darkColor: string; lightColor: string }> = {
  starting: { bg: 'rgba(250,204,21,0.1)',  darkColor: '#facc15', lightColor: '#ca8a04' },
  running:  { bg: 'rgba(96,165,250,0.1)',  darkColor: '#60a5fa', lightColor: '#2563eb' },
  finished: { bg: 'rgba(74,222,128,0.08)', darkColor: '#4ade80', lightColor: '#16a34a' },
};

function LiveTab({ test, c, theme }: { test: typeof TEST_DATA['live']; c: ReturnType<typeof useTheme>['c']; theme: string }) {
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'hesitating'|'blocked'|'done'>('all');
  const [variantFilter, setVariantFilter] = useState<'all'|'a'|'b'>('all');

  const stats = [
    { label: 'Active',     value: 0, color: theme === 'dark' ? '#60a5fa' : '#2563eb', sub: 'on the site right now'   },
    { label: 'Done',       value: 0, color: theme === 'dark' ? '#4ade80' : '#16a34a', sub: 'reached the goal'        },
    { label: 'Blocked',    value: 0, color: '#f87171',                                sub: 'gave up or crashed'       },
    { label: 'Hesitating', value: 0, color: theme === 'dark' ? '#facc15' : '#ca8a04', sub: 'last action had no effect' },
  ];

  const filterBtn = (active: boolean, label: string, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      fontSize: 11, padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
      border: `1px solid ${active ? 'rgba(74,222,128,0.4)' : 'var(--glass-border)'}`,
      background: active ? 'rgba(74,222,128,0.1)' : 'transparent',
      color: active ? c.accent : c.text3,
      fontFamily: 'Inter, sans-serif', fontWeight: active ? 600 : 400,
      transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} className="card-glass" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: c.text3, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1, marginBottom: 5 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: c.text4, lineHeight: 1.4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card-glass" style={{ padding: '16px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Panel sentiment</span>
          <span style={{ fontSize: 11, color: c.text4, fontFamily: 'JetBrains Mono, monospace' }}>no data yet</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[{ label: `Variant A · ${test.variantA}` }, { label: `Variant B · ${test.variantB}` }].map(v => (
            <div key={v.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: c.text3 }}>{v.label}</span>
                <span style={{ fontSize: 10, color: c.text4, fontFamily: 'JetBrains Mono, monospace' }}>n/a</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: '0%' }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {filterBtn(statusFilter === 'all',        'All (0)',        () => setStatusFilter('all'))}
          {filterBtn(statusFilter === 'active',     'Active (0)',     () => setStatusFilter('active'))}
          {filterBtn(statusFilter === 'hesitating', 'Hesitating (0)',() => setStatusFilter('hesitating'))}
          {filterBtn(statusFilter === 'blocked',    'Blocked (0)',   () => setStatusFilter('blocked'))}
          {filterBtn(statusFilter === 'done',       'Done (0)',      () => setStatusFilter('done'))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: c.text4 }}>Variant</span>
          {filterBtn(variantFilter === 'all', 'All', () => setVariantFilter('all'))}
          {filterBtn(variantFilter === 'a',   'A',   () => setVariantFilter('a'))}
          {filterBtn(variantFilter === 'b',   'B',   () => setVariantFilter('b'))}
        </div>
      </div>

      <div className="card-glass" style={{ padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#facc15', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>Agents are being created</div>
        <div style={{ fontSize: 12, color: c.text3, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>Each one gets its own container and browser session. They appear here within a few seconds.</div>
      </div>
    </div>
  );
}

function ResultsTab({ test, c }: { test: typeof TEST_DATA['live']; c: ReturnType<typeof useTheme>['c'] }) {
  const isRunning = test.status !== 'finished';
  return (
    <div className="card-glass" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isRunning ? '#facc15' : '#4ade80', boxShadow: `0 0 6px ${isRunning ? 'rgba(250,204,21,0.6)' : 'rgba(74,222,128,0.6)'}` }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: isRunning ? '#facc15' : c.accent, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>
          {isRunning ? 'IN PROGRESS' : 'COMPLETE'}
        </span>
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
        Results appear when every agent finishes
      </h3>
      <p style={{ fontSize: 13, color: c.text3, margin: '0 0 20px', lineHeight: 1.7, maxWidth: 520 }}>
        {test.agents === 0 ? 'No agents have started yet.' : `0 of ${test.agents} agents finished.`} Once the last one answers its exit survey, the evaluator writes the verdict.
      </p>
      <div className="progress-bar" style={{ height: 3, marginBottom: 20, maxWidth: 340 }}>
        <div className="progress-fill" style={{ width: '0%' }} />
      </div>
      <button className="btn-primary" style={{ fontSize: 13, padding: '9px 20px' }}>Watch the agents →</button>
    </div>
  );
}

export default function TestMonitor() {
  const { id } = useParams();
  const { theme, c } = useTheme();
  const test = TEST_DATA[id ?? 'live'] ?? TEST_DATA['live'];
  const [tab, setTab] = useState<'live'|'results'>('live');
  const sc = STATUS_COLORS[test.status];
  const scColor = theme === 'dark' ? sc.darkColor : sc.lightColor;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Link to="/tests" style={{ fontSize: 12, color: c.text3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Your tests
          </Link>
          <div style={{ fontSize: 9, color: c.accent, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
            LIVE TEST · 19 SEPT 2026, 14:38
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: c.text, margin: '0 0 8px', letterSpacing: '-0.025em' }}>{test.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: sc.bg, color: scColor }}>{test.status}</span>
            <span style={{ fontSize: 12, color: c.text3 }}>{test.agents > 0 ? `${test.agents} agents` : 'Setting up agents'}</span>
          </div>
        </div>
        <Link to="/tests/new" style={{ textDecoration: 'none' }}>
          <button className="btn-secondary" style={{ fontSize: 12 }}>New test</button>
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--glass-border)', marginBottom: 20 }}>
        {(['live', 'results'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? c.text : c.text3,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t ? c.accent : 'transparent'}`,
              fontFamily: 'Inter, sans-serif', transition: 'color 0.15s',
              marginBottom: -1, textAlign: 'left',
            }}
          >
            <div>{t === 'live' ? 'Live' : 'Results'}</div>
            <div style={{ fontSize: 10, color: tab === t ? c.text3 : c.text4, fontWeight: 400, marginTop: 1 }}>
              {t === 'live' ? 'watch agents in real time' : 'verdict + metrics'}
            </div>
          </button>
        ))}
      </div>

      {tab === 'live' ? <LiveTab test={test} c={c} theme={theme} /> : <ResultsTab test={test} c={c} />}
    </div>
  );
}
