// Two ways to get new personas: bring your customer data, or describe an audience in words.
import { useState } from 'react';
import type { Persona } from '../../lib/api';
import { C } from '../../lib/ui';
import Describe from './Describe';
import Upload from './Upload';

type Mode = 'upload' | 'describe';
const OPTIONS: { key: Mode; title: string; body: string; badge: string }[] = [
  { key: 'upload', title: 'Upload customer data', body: 'Bring a CRM export or any CSV with one customer per row. Your real customers become the agents.', badge: 'CSV' },
  { key: 'describe', title: 'Describe an audience', body: 'Say who uses your product in a few sentences, and a model writes personas for that audience.', badge: 'Text' },
];

export default function Create({ onSave, onDone }: { onSave: (personas: Persona[]) => void; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('upload');
  return (
    <div>
      <div role="group" aria-label="How to create personas" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
        {OPTIONS.map((o) => {
          const on = mode === o.key;
          return (
            <button key={o.key} type="button" aria-pressed={on} onClick={() => setMode(o.key)} style={{
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.text, padding: 20, borderRadius: 10,
              background: on ? C.surface2 : C.surface, border: `1.5px solid ${on ? C.text : C.border}`,
            }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{o.title}</span>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: on ? C.green : C.muted }}>{o.badge}</span>
              </span>
              <span style={{ display: 'block', marginTop: 8, fontSize: 13, lineHeight: 1.55, color: C.muted2 }}>{o.body}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        {/* both stay mounted so switching options never loses a file or a draft */}
        <div hidden={mode !== 'upload'}><Upload onSave={onSave} onDone={onDone} /></div>
        <div hidden={mode !== 'describe'}><Describe onSave={onSave} /></div>
      </div>
    </div>
  );
}
