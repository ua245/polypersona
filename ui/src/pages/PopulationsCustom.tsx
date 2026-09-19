import { Link } from 'react-router';
import { useState } from 'react';

const filters = ['All', 'Frequent', 'Occasional', 'High value', 'Lapsed'];

function avatarColor(i: number) {
  const colors = ['#16a34a','#0891b2','#7c3aed','#dc2626','#ca8a04','#0e7490','#6d28d9','#b91c1c','#a16207','#047857'];
  return colors[i % colors.length];
}

function seedRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// Placeholder agents generated from "uploaded" CSV
const AGENTS = Array.from({ length: 48 }, (_, i) => {
  const rand = seedRand(i * 53 + 13);
  const firstNames = ['James','Sophie','Liam','Olivia','Noah','Ava','Oliver','Emma','Elijah','Charlotte','Mateo','Amelia','Lucas','Mia','Aiden','Harper'];
  const lastNames = ['Smith','Jones','Williams','Brown','Taylor','Davies','Evans','Wilson','Thomas','Roberts','Johnson','Lewis','Walker','Robinson','Wood','Thompson'];
  const segments = ['Frequent','Occasional','High value','Lapsed','Frequent','Frequent','Occasional','High value'];
  const name = `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(rand() * lastNames.length)]}`;
  const segment = segments[i % segments.length];
  const spend = (rand() * 800 + 50).toFixed(0);
  const purchases = Math.floor(rand() * 24 + 1);
  return { id: `C${String(i + 1).padStart(3, '0')}`, name, segment, spend, purchases };
});

const COLUMN_HEADERS = ['Customer ID', 'Name', 'Segment', 'Avg spend', 'Purchases', 'Last active'];
const LAST_ACTIVE = ['2 days ago', '1 week ago', 'Today', '3 days ago', '2 weeks ago', 'Yesterday'];

export default function PopulationsCustom() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');

  const filtered = AGENTS.filter(a =>
    (activeFilter === 'All' || a.segment === activeFilter) &&
    (search === '' || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Link to="/populations" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>Populations</Link>
            <span style={{ color: '#1e2230' }}>›</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Custom upload</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8eaf0', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Custom agents
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            Generated from <span style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>customer_export.csv</span> · 2,438 rows · 8 columns
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/populations/new" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary" style={{ fontSize: 12 }}>Re-upload</button>
          </Link>
          <Link to="/tools" style={{ textDecoration: 'none' }}>
            <button className="btn-primary">Run this population</button>
          </Link>
        </div>
      </div>

      {/* Source file banner */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center',
        padding: '10px 16px', borderRadius: 7, marginTop: 16, marginBottom: 24,
        background: '#111318', border: '1px solid #1e2230',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="12" height="14" rx="2" stroke="#4b5563" strokeWidth="1.2"/>
            <path d="M5 5h6M5 8h6M5 11h4" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>customer_export.csv</span>
        </div>
        <div style={{ width: 1, height: 16, background: '#1e2230' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>2,438 rows</span>
        <div style={{ width: 1, height: 16, background: '#1e2230' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>8 columns mapped</span>
        <div style={{ width: 1, height: 16, background: '#1e2230' }} />
        <span className="tag-green" style={{ fontSize: 10 }}>✓ Validated</span>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4b5563' }}>Uploaded 2 minutes ago</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total agents', value: '2,438' },
          { label: 'High value', value: '312', color: '#4ade80' },
          { label: 'Frequent buyers', value: '891', color: '#60a5fa' },
          { label: 'Lapsed (>90d)', value: '187', color: '#facc15' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color ?? '#e8eaf0', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Column mapping preview */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>Column mapping</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { csv: 'customer_id', mapped: 'ID' },
            { csv: 'first_name', mapped: 'First name' },
            { csv: 'last_name', mapped: 'Last name' },
            { csv: 'email', mapped: 'Email' },
            { csv: 'city', mapped: 'Location' },
            { csv: 'total_spend', mapped: 'Avg spend' },
            { csv: 'purchase_count', mapped: 'Purchases' },
            { csv: 'last_order_date', mapped: 'Last active' },
          ].map(c => (
            <div key={c.csv} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#09090e', borderRadius: 5, border: '1px solid #1e2230' }}>
              <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{c.csv}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M6 3l2 2-2 2" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{c.mapped}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={activeFilter === f ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            {f}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 180 }}
          />
          <button
            className={view === 'grid' ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="currentColor"/>
              <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" fill="currentColor"/>
              <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" fill="currentColor"/>
              <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <button
            className={view === 'table' ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={() => setView('table')}
            title="Table view"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 3h11M1 6.5h11M1 10h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          {filtered.map((a, i) => (
            <Link key={a.id} to={`/populations/${a.id}`} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{ padding: 12, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#252a38')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2230')}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: avatarColor(i),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px', fontSize: 15, fontWeight: 700, color: '#fff', opacity: 0.85,
                }}>
                  {a.name.split(' ').map(w => w[0]).join('')}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e8eaf0', marginBottom: 2, lineHeight: 1.3 }}>{a.name}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{a.segment}</div>
                <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>{a.id}</div>
                <div style={{ fontSize: 10, color: '#4ade80', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>£{a.spend}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {COLUMN_HEADERS.map(h => (
                    <th key={h} style={{ textAlign: 'left', color: '#4b5563', padding: '10px 16px', fontWeight: 500, borderBottom: '1px solid #1e2230', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{ borderTop: i > 0 ? '1px solid #111318' : undefined, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0f1118')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {}}
                  >
                    <td style={{ padding: '9px 16px', color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{a.id}</td>
                    <td style={{ padding: '9px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {a.name.split(' ').map(w => w[0]).join('')}
                        </div>
                        <span style={{ color: '#e8eaf0' }}>{a.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 16px' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                        background: a.segment === 'High value' ? 'rgba(74,222,128,0.1)' : a.segment === 'Lapsed' ? 'rgba(250,204,21,0.1)' : 'rgba(107,114,128,0.1)',
                        color: a.segment === 'High value' ? '#4ade80' : a.segment === 'Lapsed' ? '#facc15' : '#9ca3af',
                      }}>
                        {a.segment}
                      </span>
                    </td>
                    <td style={{ padding: '9px 16px', color: '#4ade80', fontFamily: 'JetBrains Mono, monospace' }}>£{a.spend}</td>
                    <td style={{ padding: '9px 16px', color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>{a.purchases}</td>
                    <td style={{ padding: '9px 16px', color: '#6b7280' }}>{LAST_ACTIVE[i % LAST_ACTIVE.length]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center' }}>
        Showing {filtered.length} of {AGENTS.length} sampled agents · placeholder data · backend to be wired
      </div>
    </div>
  );
}
