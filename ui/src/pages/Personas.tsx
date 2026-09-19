// /personas — everyone who can test for you: the built-in personas, plus the ones you generate.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getPersonas, loadCustomPersonas, saveCustomPersonas, type Persona } from '../lib/api';
import { C } from '../lib/ui';
import Create from './personas/Create';
import { Avatar, PersonaDetail, descriptor, type Entry } from './personas/PersonaBits';

type Filter = 'all' | 'built-in' | 'custom' | 'desktop' | 'mobile';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'built-in', label: 'Built-in' }, { key: 'custom', label: 'Custom' }, { key: 'desktop', label: 'Desktop' }, { key: 'mobile', label: 'Mobile' },
];

const STYLES = `
.pp-person { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 100%; height: 100%; padding: 18px 10px 14px; text-align: center; cursor: pointer; font-family: inherit; color: inherit; background: #111318; border: 1px solid #1e2230; border-radius: 8px; transition: border-color 0.15s, background 0.15s; }
.pp-person:hover { background: #181b22; border-color: #252a38; }
.pp-person[aria-expanded="true"] { border-color: #4ade80; background: #181b22; }
.pp-file-label { cursor: pointer; }
input[type=file]:focus-visible + .pp-file-label { outline: 2px solid #4ade80; outline-offset: 2px; }
.pp-person-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
`;

const isPersona = (p: unknown): p is Persona => typeof p === 'object' && p !== null && typeof (p as Persona).id === 'string' && typeof (p as Persona).name === 'string';

export default function Personas() {
  const [builtIn, setBuiltIn] = useState<Persona[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [custom, setCustom] = useState<Persona[]>(() => { const c = loadCustomPersonas(); return Array.isArray(c) ? c.filter(isPersona) : []; });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError('');
    getPersonas().then((p) => { if (alive) setBuiltIn(p); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [attempt]);

  const updateCustom = (next: Persona[]) => { setCustom(next); saveCustomPersonas(next); };
  const addCustom = (fresh: Persona[]) => {
    const byId = new Map<string, Persona>();
    for (const p of loadCustomPersonas().filter(isPersona)) byId.set(p.id, p); // read fresh, another tab may have saved too
    for (const p of fresh) byId.set(p.id, p); // a regenerated persona with the same id replaces the old one
    updateCustom([...byId.values()]);
    setFilter('custom'); setQuery('');
  };

  const entries: Entry[] = useMemo(() => [
    ...(builtIn ?? []).map((persona) => ({ persona, source: 'built-in' as const })),
    ...custom.map((persona) => ({ persona, source: 'custom' as const })),
  ], [builtIn, custom]);
  const keyOf = (e: Entry) => `${e.source}:${e.persona.id}`;
  const q = query.trim().toLowerCase();
  const visible = entries.filter((e) =>
    (filter === 'all' || (filter === 'built-in' || filter === 'custom' ? e.source === filter : e.persona.device === filter))
    && (!q || e.persona.name.toLowerCase().includes(q) || (e.persona.bio ?? '').toLowerCase().includes(q)));
  const countFor = (f: Filter) => entries.filter((e) => f === 'all' || (f === 'built-in' || f === 'custom' ? e.source === f : e.persona.device === f)).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 72px' }}>
      <style>{STYLES}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Personas</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(24px, 4vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em' }}>The people who test for you</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6, color: C.muted2, maxWidth: 640 }}>
            Each persona is a synthetic user with a background, a device, and a limited amount of patience; in a test, every one of them uses your site in a real browser and tells you what went wrong.
          </p>
        </div>
        <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>New test</Link>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 14px' }}>
        <div role="group" aria-label="Filter personas" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button key={f.key} type="button" aria-pressed={on} onClick={() => setFilter(f.key)} style={{
                background: on ? C.green : 'transparent', color: on ? C.bg : C.muted2, fontWeight: on ? 600 : 400,
                border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {f.label} <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{countFor(f.key)}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: '0 1 240px', minWidth: 160 }}>
          <label htmlFor="pp-persona-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search personas by name or bio</label>
          <input id="pp-persona-search" className="input" type="search" placeholder="Search name or bio…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && (
        <div role="alert" className="card" style={{ padding: 14, marginBottom: 12, fontSize: 13, borderColor: 'rgba(248,113,113,0.4)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span><b style={{ color: C.red }}>The built-in personas could not be loaded.</b> {error}{custom.length > 0 && ' Your custom personas are shown below.'}</span>
          <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      )}

      {builtIn == null && !error && custom.length === 0 ? (
        <div className="card" role="status" style={{ padding: 40, textAlign: 'center', fontSize: 13, color: C.muted2 }}>Loading personas…</div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{filter === 'custom' && !q ? 'No custom personas yet' : 'No persona matches'}</div>
          <div style={{ fontSize: 13, color: C.muted2, marginTop: 6 }}>
            {filter === 'custom' && !q ? <>Describe an audience below and a model writes personas for it. <a href="#pp-create" style={{ color: C.green }}>Create personas</a></>
              : <>Try a different filter or search. <button type="button" onClick={() => { setFilter('all'); setQuery(''); }} style={{ background: 'none', border: 'none', padding: 0, color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Show everyone</button></>}
          </div>
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, gridAutoFlow: 'dense', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 148px), 1fr))' }}>
          {visible.flatMap((e) => {
            const key = keyOf(e);
            const open = openKey === key;
            const panelId = `pp-persona-${key.replace(/[^a-z0-9_-]/gi, '-')}`;
            const card = (
              <li key={key} style={{ minWidth: 0 }}>
                <button type="button" className="pp-person" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpenKey(open ? null : key)}>
                  <Avatar name={e.persona.name} />
                  <span style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: C.text }}>{e.persona.name}</span>
                  <span className="pp-person-desc" style={{ fontSize: 11, lineHeight: 1.4, color: C.muted2, minHeight: 31 }}>{descriptor(e.persona)}</span>
                  <span className="mono" style={{ marginTop: 6, fontSize: 10, letterSpacing: '0.04em', color: e.source === 'custom' ? C.blue : C.muted }}>{e.source} · {e.persona.device}</span>
                </button>
              </li>
            );
            if (!open) return [card];
            return [card, (
              <li key={`${key}-detail`} id={panelId} style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <PersonaDetail entry={e} onClose={() => setOpenKey(null)} onRemove={e.source === 'custom' ? () => { updateCustom(custom.filter((p) => p.id !== e.persona.id)); setOpenKey(null); } : undefined} />
              </li>
            )];
          })}
        </ul>
      )}
      <p style={{ margin: '12px 0 0', fontSize: 12, color: C.muted }}>
        Select a persona to read its full profile. Custom personas are stored in this browser only: they are not uploaded or shared, and clearing site data removes them. When you start a test with them, their definitions are sent with that test.
      </p>

      <section id="pp-create" aria-labelledby="pp-create-title" style={{ marginTop: 48, scrollMarginTop: 80 }}>
        <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Create personas</div>
        <h2 id="pp-create-title" style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>How do you want to build your audience?</h2>
        <p style={{ margin: '4px 0 16px', fontSize: 13, color: C.muted2 }}>Bring your own customer data, or describe the people who use your product.</p>
        <Create onSave={addCustom} onDone={() => window.scrollTo({ top: 0 })} />
      </section>
    </div>
  );
}
