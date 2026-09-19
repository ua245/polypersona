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
.pp-person { display: flex; flex-direction: column; gap: 12px; width: 100%; height: 100%; padding: 16px; text-align: left; cursor: pointer; font-family: inherit; color: inherit;
  background: var(--pp-surface); border: 1px solid var(--pp-border); border-radius: 10px; transition: border-color 0.15s, box-shadow 0.15s; }
.pp-person:hover { border-color: var(--pp-border2); box-shadow: 0 4px 14px var(--pp-shadow); }
.pp-person[aria-expanded="true"] { border-color: var(--pp-accent); box-shadow: 0 0 0 1px var(--pp-accent) inset; }
.pp-person-top { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pp-person-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.pp-person-src { margin-left: auto; align-self: flex-start; white-space: nowrap; flex-shrink: 0; font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--pp-border); color: var(--pp-muted); }
.pp-person-src.custom { color: var(--pp-blue); border-color: rgba(var(--pp-blue-rgb),0.35); }
.pp-attrs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 12px; border-top: 1px solid var(--pp-border); }
.pp-attr { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pp-attr span:first-child { font: 500 9.5px 'JetBrains Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pp-muted); }
.pp-attr span:last-child { font-size: 12.5px; color: var(--pp-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-level { display: inline-flex; gap: 2px; margin-left: 6px; vertical-align: middle; }
.pp-level i { width: 10px; height: 4px; border-radius: 1px; background: var(--pp-border2); }
.pp-level i[data-on="true"] { background: var(--pp-accent); }
.pp-file-label { cursor: pointer; }
input[type=file]:focus-visible + .pp-file-label { outline: 2px solid var(--pp-accent); outline-offset: 2px; }
.pp-hero { padding-bottom: 24px; border-bottom: 1px solid var(--pp-border); }
.pp-filters { display: inline-flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--pp-surface); border: 1px solid var(--pp-border); }
.pp-filters button { border: 0; border-radius: 6px; padding: 5px 12px; font: 500 13px 'Inter', sans-serif; cursor: pointer; background: transparent; color: var(--pp-muted2); }
.pp-filters button[aria-pressed="true"] { background: var(--pp-surface2); color: var(--pp-text); box-shadow: 0 1px 2px var(--pp-shadow); }
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
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px 80px' }}>
      <style>{STYLES}</style>
      <div className="pp-hero" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Personas</div>
          <h1 style={{ margin: '10px 0 0', fontSize: 'clamp(28px, 3.6vw, 36px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>The people who test for you</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: C.muted2, maxWidth: 680 }}>
            Each persona is a synthetic user with a background, a device, and a limited amount of patience; in a test, every one of them uses your site in a real browser and tells you what went wrong.
          </p>
        </div>
        <Link to="/new" className="btn-primary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>New test</Link>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 16px' }}>
        <div role="group" aria-label="Filter personas" className="pp-filters">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} <span className="mono" style={{ fontSize: 11, opacity: 0.6, marginLeft: 2 }}>{countFor(f.key)}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: '0 1 240px', minWidth: 160 }}>
          <label htmlFor="pp-persona-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search personas by name or bio</label>
          <input id="pp-persona-search" className="input" type="search" placeholder="Search name or bio…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && (
        <div role="alert" className="card" style={{ padding: 14, marginBottom: 12, fontSize: 13, borderColor: 'rgba(var(--pp-red-rgb),0.4)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
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
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, gridAutoFlow: 'dense', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))' }}>
          {visible.flatMap((e) => {
            const key = keyOf(e);
            const open = openKey === key;
            const panelId = `pp-persona-${key.replace(/[^a-z0-9_-]/gi, '-')}`;
            const card = (
              <li key={key} style={{ minWidth: 0 }}>
                <button type="button" className="pp-person" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpenKey(open ? null : key)}>
                  <span className="pp-person-top">
                    <Avatar name={e.persona.name} size={40} />
                    <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.persona.name}</span>
                      <span className="pp-person-desc" style={{ fontSize: 12, lineHeight: 1.4, color: C.muted2 }}>{descriptor(e.persona)}</span>
                    </span>
                    <span className={`pp-person-src ${e.source}`}>{e.source}</span>
                  </span>
                  <span className="pp-attrs">
                    <span className="pp-attr"><span>Device</span><span>{e.persona.device === 'mobile' ? 'Mobile' : 'Desktop'}</span></span>
                    <span className="pp-attr"><span>Tech savviness</span><span style={{ textTransform: 'capitalize' }}>{e.persona.tech_savviness}
                      <span className="pp-level" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} data-on={i <= ['low', 'medium', 'high'].indexOf(e.persona.tech_savviness)} />)}</span></span></span>
                    <span className="pp-attr"><span>Patience</span><span>~{e.persona.patience_steps} actions</span></span>
                    <span className="pp-attr"><span>Reading</span><span>{e.persona.reading_style === 'reads_everything' ? 'Reads everything' : 'Skims'}</span></span>
                  </span>
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

      <section id="pp-create" aria-labelledby="pp-create-title" style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${C.border}`, scrollMarginTop: 80 }}>
        <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Create personas</div>
        <h2 id="pp-create-title" style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>How do you want to build your audience?</h2>
        <p style={{ margin: '4px 0 16px', fontSize: 13, color: C.muted2 }}>Bring your own customer data, or describe the people who use your product.</p>
        <Create onSave={addCustom} onDone={() => window.scrollTo({ top: 0 })} />
      </section>
    </div>
  );
}
