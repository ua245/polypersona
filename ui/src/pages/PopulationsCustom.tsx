// /populations/custom — personas generated in the UI and kept in this browser.
import { useState } from 'react';
import { Link } from 'react-router';
import { loadCustomPersonas, saveCustomPersonas, type Persona } from '../lib/api';
import { C, Empty, Page, Tag } from '../lib/ui';

/** One persona, read-only, with an optional remove button. Shared with the create-population wizard. */
export function PersonaCard({ persona, onRemove }: { persona: Persona; onRemove?: () => void }) {
  const list = (label: string, items: string[]) => items.length > 0 && (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', fontSize: 12, lineHeight: 1.55, color: C.muted2 }}>
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
  return (
    <li className="card" style={{ padding: 16, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{persona.name}</h3>
          <div className="mono" style={{ fontSize: 11, color: C.muted, overflowWrap: 'anywhere' }}>{persona.id}</div>
        </div>
        {onRemove && (
          <button type="button" className="btn-ghost" onClick={onRemove} aria-label={`Remove ${persona.name}`} style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}>Remove</button>
        )}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: C.muted2 }}>{persona.bio}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <Tag tone="blue">{persona.device}</Tag>
        <Tag>{persona.tech_savviness} savviness</Tag>
        <Tag>patience {persona.patience_steps} actions</Tag>
        <Tag>{persona.reading_style === 'reads_everything' ? 'reads everything' : 'skims'}</Tag>
      </div>
      {list('Goals', persona.goals ?? [])}
      {list('Frustrations', persona.frustrations ?? [])}
    </li>
  );
}

export const personaGrid = { margin: 0, padding: 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' } as const;

export default function PopulationsCustom() {
  const [personas, setPersonas] = useState<Persona[]>(() => loadCustomPersonas());
  const [confirming, setConfirming] = useState(false);

  const update = (next: Persona[]) => { setPersonas(next); saveCustomPersonas(next); setConfirming(false); };

  return (
    <Page
      title="Custom personas"
      subtitle="Personas you generated from an audience description."
      actions={(
        <>
          <Link to="/populations/new" className="btn-secondary" style={{ textDecoration: 'none' }}>Generate more</Link>
          {personas.length > 0 && <Link to="/tools" className="btn-primary" style={{ textDecoration: 'none' }}>Use in a test</Link>}
        </>
      )}
    >
      <p style={{ margin: '0 0 20px', fontSize: 13, lineHeight: 1.6, color: C.muted2, maxWidth: 760 }}>
        These are stored in this browser only, in local storage. They are not uploaded, not shared with your team, and clearing site data removes them.
        When you start a test with them, their full definitions are sent along with that run.
      </p>

      {personas.length === 0 ? (
        <Empty title="No custom personas saved">
          Describe an audience and have a set of personas written for it. <Link to="/populations/new" style={{ color: C.green }}>Create a population</Link>
        </Empty>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.muted }}>{personas.length} saved</div>
            {confirming ? (
              <div role="group" aria-label="Confirm clearing all personas" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.muted2 }}>
                Remove all {personas.length}?
                <button type="button" className="btn-secondary" onClick={() => update([])} style={{ fontSize: 12, padding: '4px 10px', color: C.red }}>Yes, clear all</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setConfirming(true)} style={{ fontSize: 12 }}>Clear all</button>
            )}
          </div>
          <ul style={personaGrid}>
            {personas.map((p) => <PersonaCard key={p.id} persona={p} onRemove={() => update(personas.filter((x) => x.id !== p.id))} />)}
          </ul>
        </>
      )}
    </Page>
  );
}
