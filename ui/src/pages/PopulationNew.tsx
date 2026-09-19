import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';

type Method = 'upload' | 'london' | null;

interface UploadedFile {
  name: string;
  rows: number;
  cols: number;
}

export default function PopulationNew() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const totalSteps = 2;
  const stepLabel = `NEW POPULATION · STEP ${step + 1} OF ${totalSteps}`;

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile({ name: f.name, rows: 2438, cols: 8 });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile({ name: f.name, rows: 2438, cols: 8 });
  }

  const canProceed = method === 'london' || (method === 'upload' && file !== null);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '52px 48px' }}>
      <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 8, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {stepLabel}
      </div>

      {step === 0 && (
        <StepChoose
          method={method}
          setMethod={setMethod}
          dragging={dragging}
          setDragging={setDragging}
          file={file}
          setFile={setFile}
          fileRef={fileRef}
          handleFileDrop={handleFileDrop}
          handleFileInput={handleFileInput}
          canProceed={canProceed}
          onNext={() => setStep(1)}
        />
      )}

      {step === 1 && (
        <StepConfigure
          method={method}
          file={file}
          onBack={() => setStep(0)}
          onFinish={() => navigate(method === 'upload' ? '/populations/custom' : '/populations')}
        />
      )}
    </div>
  );
}

function StepChoose({
  method, setMethod, dragging, setDragging,
  file, setFile, fileRef, handleFileDrop, handleFileInput, canProceed, onNext,
}: {
  method: Method; setMethod: (m: Method) => void;
  dragging: boolean; setDragging: (v: boolean) => void;
  file: UploadedFile | null; setFile: (f: UploadedFile | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  handleFileDrop: (e: React.DragEvent) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  canProceed: boolean; onNext: () => void;
}) {
  return (
    <>
      <h1 style={{ fontSize: 34, fontWeight: 700, color: '#e8eaf0', margin: '0 0 10px', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
        How do you want to build your population?
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 36px', lineHeight: 1.6 }}>
        Bring your own customer dataset or use the pre-built London population.
      </p>

      {/* Option cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: method === 'upload' ? 16 : 32 }}>
        {[
          {
            key: 'upload' as const,
            label: 'Upload customer data',
            desc: 'Bring your own CRM export, analytics data, or any CSV with customer attributes.',
            badge: null,
          },
          {
            key: 'london' as const,
            label: 'Use London data',
            desc: '100 realistic London-based customer agents, ready to run immediately.',
            badge: '100 agents ready',
          },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setMethod(method === opt.key ? null : opt.key)}
            style={{
              background: method === opt.key ? '#111318' : '#09090e',
              border: `1px solid ${method === opt.key ? '#4ade80' : '#1e2230'}`,
              borderRadius: 8, padding: '20px 20px', textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{opt.label}</div>
              {opt.badge && (
                <span className="tag-green" style={{ fontSize: 9, whiteSpace: 'nowrap', marginLeft: 8 }}>{opt.badge}</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{opt.desc}</div>
          </button>
        ))}
      </div>

      {/* Inline upload drop zone — appears when Upload is selected */}
      {method === 'upload' && (
        <div style={{ marginBottom: 28 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.json"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              style={{
                border: `2px dashed ${dragging ? '#4ade80' : '#252a38'}`,
                borderRadius: 10, padding: '40px 32px',
                textAlign: 'center',
                background: dragging ? 'rgba(74,222,128,0.04)' : '#09090e',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ margin: '0 auto', display: 'block' }}>
                  <path d="M14 4v14M8 10l6-6 6 6" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 20v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 4 }}>
                Drop your CSV file here
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>CSV, XLSX or JSON · up to 10 GB · one customer per row</div>
              <button
                className="btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 10,
              background: 'rgba(74,222,128,0.06)',
              border: '1px solid rgba(74,222,128,0.2)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 7,
                background: 'rgba(74,222,128,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9l4 4 8-8" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 2 }}>{file.name}</div>
                <div style={{ fontSize: 11, color: '#4ade80' }}>{file.rows.toLocaleString()} rows · {file.cols} columns detected</div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px', color: '#6b7280' }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-primary"
          onClick={onNext}
          disabled={!canProceed}
          style={{ opacity: canProceed ? 1 : 0.35, fontSize: 14, padding: '9px 22px' }}
        >
          {method === 'london' ? 'Use London population →' : 'Continue with upload →'}
        </button>
      </div>
    </>
  );
}

function StepConfigure({
  method, file, onBack, onFinish,
}: {
  method: Method; file: UploadedFile | null; onBack: () => void; onFinish: () => void;
}) {
  const [name, setName] = useState(
    method === 'london' ? 'London 100' : file ? file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') : 'My Population'
  );
  const [size, setSize] = useState(method === 'upload' && file ? String(file.rows) : '100');
  const defaultFilters = method === 'london'
    ? ['London', 'Age 25–45', 'Email verified']
    : ['Purchased in last 6mo', 'Email verified'];
  const [activeFilters, setActiveFilters] = useState<string[]>(defaultFilters);

  function removeFilter(f: string) {
    setActiveFilters(prev => prev.filter(x => x !== f));
  }

  return (
    <>
      <h1 style={{ fontSize: 34, fontWeight: 700, color: '#e8eaf0', margin: '0 0 10px', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
        {method === 'london' ? 'Configure the London population' : 'Configure your population'}
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 32px', lineHeight: 1.6 }}>
        {method === 'london'
          ? '100 London-based agents are ready. Give the population a name and run.'
          : `Mapping ${file?.rows.toLocaleString()} rows from ${file?.name}. Set a name, size and filters.`}
      </p>

      {/* Source badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderRadius: 7, marginBottom: 28,
        background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
      }}>
        <span className="dot-green" />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {method === 'london'
            ? 'Pre-built London dataset — backend to be wired. Agent profiles are placeholder.'
            : `Custom dataset from ${file?.name} — ${file?.rows.toLocaleString()} customers · ${file?.cols} columns`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        <div>
          <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Population name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Population size</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" value={size} onChange={e => setSize(e.target.value)} type="number" style={{ width: 120 }} />
            {method === 'upload' && file && (
              <span style={{ fontSize: 12, color: '#4b5563' }}>of {file.rows.toLocaleString()} available</span>
            )}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 8 }}>Filters</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {activeFilters.map(f => (
              <button key={f} className="tag-green" style={{ cursor: 'pointer', border: 'none', background: 'rgba(74,222,128,0.1)' }} onClick={() => removeFilter(f)}>
                {f} ×
              </button>
            ))}
            <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>+ Add filter</button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="card" style={{ padding: 16, marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Preview</div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'baseline' }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', fontFamily: 'JetBrains Mono, monospace' }}>{size}</span>
            <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 6 }}>
              {method === 'london' ? 'people in London' : 'custom agents'}
            </span>
          </div>
          {method === 'upload' && file && (
            <div style={{ fontSize: 12, color: '#4b5563' }}>
              From {file.rows.toLocaleString()} matching customers
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" style={{ fontSize: 14, padding: '9px 22px' }} onClick={onFinish}>
          {method === 'london' ? 'View London population →' : 'Create custom population →'}
        </button>
      </div>
    </>
  );
}
