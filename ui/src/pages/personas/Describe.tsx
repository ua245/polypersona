// Describe an audience in words and a model writes personas for it.
import { useEffect, useId, useState } from 'react';
import { generatePersonas, type Persona } from '../../lib/api';
import { C, useTokenGate } from '../../lib/ui';
import { Link } from 'react-router';
import { PreviewCard } from './PersonaBits';

const COUNTS = [2, 3, 4, 5, 6];

export default function Describe({ onSave }: { onSave: (personas: Persona[]) => void }) {
  const { guard, handleAuthError, dialog } = useTokenGate();
  const fieldId = useId();
  const [audience, setAudience] = useState('');
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<Persona[] | null>(null);
  const [saved, setSaved] = useState(0);

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
      setBusy(true); setError(''); setSaved(0);
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
    onSave(generated);
    setSaved(generated.length); setGenerated(null); setAudience('');
  };

  return (
    <div>
      {dialog}
        <form className="card" style={{ padding: 20, minWidth: 0, borderColor: C.border2 }} onSubmit={(e) => { e.preventDefault(); generate(); }}>
          <label htmlFor={fieldId} style={{ display: 'block', margin: '0 0 8px', fontSize: 13, lineHeight: 1.55, color: C.muted2 }}>
            Who they are, what they come to do, what device they use, and what tends to trip them up. Specifics produce better personas than adjectives.
          </label>
          <textarea
            id={fieldId} className="input" rows={4} value={audience} disabled={busy} onChange={(e) => setAudience(e.target.value)}
            placeholder="For example: parents ordering school uniforms once a year, mostly on a phone in the evening, often unsure of sizes and wary of paying for returns."
            style={{ resize: 'vertical', minHeight: 96 }}
          />
          <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
            <legend style={{ fontSize: 12, color: C.muted2, padding: 0, marginBottom: 6 }}>How many personas</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COUNTS.map((n) => (
                <button key={n} type="button" aria-pressed={count === n} disabled={busy} onClick={() => setCount(n)} className="mono" style={{
                  width: 36, height: 32, borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  background: count === n ? 'rgba(74,222,128,0.1)' : 'transparent', color: count === n ? C.green : C.muted2, border: `1px solid ${count === n ? 'rgba(74,222,128,0.3)' : C.border}`,
                }}>{n}</button>
              ))}
            </div>
          </fieldset>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button type="submit" className={generated ? 'btn-secondary' : 'btn-primary'} disabled={busy || !audience.trim()}>{busy ? 'Generating…' : generated ? 'Generate again' : 'Generate'}</button>
            <div aria-live="polite" style={{ fontSize: 12, color: C.muted2, flex: '1 1 180px' }}>
              {busy ? (
                <><span className="dot-yellow" style={{ marginRight: 8, animation: 'pp-pulse 1.4s ease-in-out infinite' }} />Writing {count} personas. This usually takes 10 to 20 seconds. <span className="mono" style={{ color: C.muted }}>{seconds}s</span></>
              ) : generated ? 'Generating again replaces the preview below.'
                : saved > 0 ? <span style={{ color: C.green }}>Saved {saved} {saved === 1 ? 'persona' : 'personas'}. They are in the grid above, tagged custom.</span>
                : 'Needs sign-in, because it calls a model. Nothing is saved until you choose to.'}
            </div>
          </div>
          {saved > 0 && !generated && !busy && <Link to="/new?panel=custom" className="btn-primary" style={{ display: 'inline-block', marginTop: 14, textDecoration: 'none' }}>Test with these personas</Link>}
          {error && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 12 }}>Could not generate personas: {error}</div>}
        </form>


      {generated && (
        <section aria-label="Generated personas" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: C.muted2 }}><b style={{ color: C.text, fontWeight: 600 }}>Preview · {generated.length}</b> Remove any that do not ring true, then save the rest.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setGenerated(null)}>Discard</button>
              <button type="button" className="btn-primary" disabled={generated.length === 0 || busy} onClick={save}>Save personas{generated.length > 0 ? ` (${generated.length})` : ''}</button>
            </div>
          </div>
          {generated.length === 0 ? (
            <div className="card" style={{ padding: 20, fontSize: 13, color: C.muted2 }}>You removed every persona. Generate again to get a new set.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
              {generated.map((p) => <PreviewCard key={p.id} persona={p} onRemove={() => setGenerated(generated.filter((x) => x.id !== p.id))} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
