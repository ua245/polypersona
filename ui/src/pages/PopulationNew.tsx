// /populations/new — describe an audience, generate personas for it, keep the ones you want.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { generatePersonas, loadCustomPersonas, saveCustomPersonas, type Persona } from '../lib/api';
import { C, Page, SectionLabel, useTokenGate } from '../lib/ui';
import { PersonaCard, personaGrid } from './PopulationsCustom';

const MIN = 2;
const MAX = 8;
const COUNTS = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i);

export default function PopulationNew() {
  const navigate = useNavigate();
  const { guard, handleAuthError, dialog } = useTokenGate();
  const [audience, setAudience] = useState('');
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<Persona[] | null>(null);

  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const generate = () => {
    const text = audience.trim();
    if (!text || busy) return;
    guard(async () => {
      setBusy(true); setError('');
      try {
        const personas = await generatePersonas(text, count);
        if (!Array.isArray(personas) || personas.length === 0) throw new Error('The generator returned no personas. Try a more specific description.');
        setGenerated(personas);
      } catch (e) {
        if (!handleAuthError(e, generate)) setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    });
  };

  const save = () => {
    if (!generated?.length) return;
    const byId = new Map<string, Persona>();
    for (const p of loadCustomPersonas()) byId.set(p.id, p);
    for (const p of generated) byId.set(p.id, p); // a regenerated persona with the same id replaces the old one
    saveCustomPersonas([...byId.values()]);
    navigate('/populations/custom');
  };

  const step = generated ? 2 : 1;
  return (
    <Page
      title="Create a population"
      subtitle="Describe who uses your product. A model writes personas for that audience; you keep the ones that ring true."
      actions={<Link to="/populations/custom" className="btn-ghost" style={{ textDecoration: 'none' }}>Saved personas</Link>}
    >
      {dialog}
      <ol aria-label="Steps" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', margin: '0 0 20px', padding: 0, listStyle: 'none', fontSize: 12 }}>
        {['Describe the audience', 'Review and save'].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? 'step' : undefined} style={{ color: step === i + 1 ? C.text : C.muted }}>
            <span className="mono" style={{ color: step === i + 1 ? C.green : C.muted, marginRight: 6 }}>{i + 1}</span>{label}
          </li>
        ))}
      </ol>

      <form className="card" style={{ padding: 20, maxWidth: 820 }} onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <label htmlFor="pp-audience" style={{ fontSize: 13, fontWeight: 500 }}>Audience</label>
        <p style={{ margin: '4px 0 8px', fontSize: 12, color: C.muted }}>
          Who they are, what they come to do, what devices they use, and anything that tends to trip them up. Specifics produce better personas than adjectives.
        </p>
        <textarea
          id="pp-audience"
          className="input"
          rows={5}
          value={audience}
          disabled={busy}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="For example: parents ordering school uniforms once a year, mostly on a phone in the evening, often unsure of sizes and wary of paying for returns."
          style={{ resize: 'vertical', minHeight: 110 }}
        />

        <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
          <legend style={{ fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 8 }}>How many personas</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                disabled={busy}
                onClick={() => setCount(n)}
                className="mono"
                style={{
                  width: 36, height: 32, borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  background: count === n ? 'rgba(74,222,128,0.1)' : 'transparent', color: count === n ? C.green : C.muted2,
                  border: `1px solid ${count === n ? 'rgba(74,222,128,0.3)' : C.border}`,
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted }}>Each persona runs once per variant per repeat, so more personas means more containers and more tokens per test.</p>
        </fieldset>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 20 }}>
          <button type="submit" className={generated ? 'btn-secondary' : 'btn-primary'} disabled={busy || !audience.trim()}>
            {busy ? 'Generating…' : generated ? 'Generate again' : 'Generate'}
          </button>
          <div aria-live="polite" style={{ fontSize: 12, color: C.muted2 }}>
            {busy ? (
              <>
                <span className="dot-yellow" style={{ marginRight: 8, animation: 'pp-pulse 1.4s ease-in-out infinite' }} />
                Writing {count} personas. This usually takes 10 to 20 seconds. <span className="mono" style={{ color: C.muted }}>{seconds}s</span>
              </>
            ) : generated ? 'Generating again replaces the set below.' : 'Needs the team token. Nothing is saved until you choose to.'}
          </div>
        </div>
        {error && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 12 }}>Could not generate personas: {error}</div>}
      </form>

      {generated && (
        <section style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <SectionLabel>Generated personas · {generated.length}</SectionLabel>
              <div style={{ fontSize: 12, color: C.muted }}>Remove any that do not fit. The rest are saved in this browser.</div>
            </div>
            <button type="button" className="btn-primary" disabled={generated.length === 0 || busy} onClick={save}>
              Save population{generated.length > 0 ? ` (${generated.length})` : ''}
            </button>
          </div>
          {generated.length === 0 ? (
            <div className="card" style={{ padding: 24, fontSize: 13, color: C.muted2 }}>You removed every persona. Generate again to get a new set.</div>
          ) : (
            <ul style={personaGrid}>
              {generated.map((p) => <PersonaCard key={p.id} persona={p} onRemove={() => setGenerated(generated.filter((x) => x.id !== p.id))} />)}
            </ul>
          )}
        </section>
      )}
    </Page>
  );
}
