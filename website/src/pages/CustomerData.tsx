import { Link } from 'react-router';

const rows = [
  { id: '1.01', age: 34, city: 'London', frequency: 'Frequent', digital: 'High', confidence: 8 },
  { id: '1.02', age: 28, city: 'Leeds', frequency: 'Occasional', digital: 'Medium', confidence: 6 },
  { id: '1.03', age: 45, city: 'Leeds', frequency: 'Frequent', digital: 'Medium', confidence: 7 },
  { id: '1.04', age: 52, city: 'Bristol', frequency: 'New', digital: 'Low', confidence: 3 },
  { id: '1.05', age: 31, city: 'Glasgow', frequency: 'Frequent', digital: 'High', confidence: 9 },
  { id: '1.06', age: 39, city: 'London', frequency: 'Annual', digital: 'Medium', confidence: 5 },
  { id: '1.07', age: 24, city: 'Manchester', frequency: 'Frequent', digital: 'High', confidence: 9 },
  { id: '1.08', age: 61, city: 'Bristol', frequency: 'Occasional', digital: 'Low', confidence: 2 },
];

function ConfidenceBar({ val }: { val: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{
          width: 6, height: 12, borderRadius: 1,
          background: i < val ? '#4ade80' : '#1e2230',
        }} />
      ))}
    </div>
  );
}

export default function CustomerData() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px' }}>
      <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>CUSTOMER DATA</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8eaf0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Check your customer data</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>We recognise 2,438 customer rows. Review field mapping, warnings and privacy checks before agent creation.</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total rows', value: '2,438' },
          { label: 'Mapped fields', value: '8 of 9' },
          { label: 'Privacy status', value: 'Ready', color: '#4ade80' },
          { label: 'Validation', value: 'Passed', color: '#4ade80' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color || '#e8eaf0', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2230', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>customer_expansion.csv</span>
            <span className="tag-green" style={{ fontSize: 10 }}>✓ Uploaded</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['ID', 'Age', 'City', 'Frequency', 'Digital', 'Confidence'].map(h => (
                    <th key={h} style={{ textAlign: 'left', color: '#4b5563', padding: '10px 16px', fontWeight: 500, borderBottom: '1px solid #1e2230' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} style={{ borderTop: i > 0 ? '1px solid #111318' : undefined }}>
                    <td style={{ padding: '9px 16px', color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>{row.id}</td>
                    <td style={{ padding: '9px 16px', color: '#e8eaf0' }}>{row.age}</td>
                    <td style={{ padding: '9px 16px', color: '#e8eaf0' }}>{row.city}</td>
                    <td style={{ padding: '9px 16px', color: '#9ca3af' }}>{row.frequency}</td>
                    <td style={{ padding: '9px 16px', color: '#9ca3af' }}>{row.digital}</td>
                    <td style={{ padding: '9px 16px' }}><ConfidenceBar val={row.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Issues panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#facc15', marginBottom: 8 }}>1 Warning</div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>Some customer data does not meet complete minimum standards. A 5 persons will not be assigned the testing. Customers data with an all on in the based and complete checkout. Use your own judgment when choosing colour and delivery.</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>1 Passed</div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>Order confirmation page reached and order reference captured</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', marginBottom: 8 }}>Optional notes</div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>Pay attention to delivery choice and promotional code messaging.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Link to="/populations/new" style={{ textDecoration: 'none', flex: 1 }}>
              <button className="btn-secondary" style={{ width: '100%' }}>← Back</button>
            </Link>
            <Link to="/tools" style={{ textDecoration: 'none', flex: 1 }}>
              <button className="btn-primary" style={{ width: '100%' }}>Custom and create →</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
