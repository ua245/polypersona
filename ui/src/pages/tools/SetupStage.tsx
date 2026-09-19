// Stage 1: choose personas, target and repeats, then start the run.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { fmtTime, fmtTokens, getPersonas, loadCustomPersonas, startRun, useRuns, type Persona, type RunConfig } from '../../lib/api';
import { C, RunStatusTag, SectionLabel, useTokenGate } from '../../lib/ui';

type Target = 'demo' | 'site';
const VARIANTS: { id: string; name: string; blurb: string }[] = [
  { id: 'a', name: 'A', blurb: 'Clean checkout' },
  { id: 'b', name: 'B', blurb: 'Dark patterns and a bug' },
  { id: 'c', name: 'C', blurb: 'Plausible redesign with a pre-ticked subscription' },
];

const firstLine = (bio: string) => {
  const m = bio.trim().match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : bio.trim();
};
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+|^https?:\/\/localhost/i.test(v.trim());

export default function SetupStage({ showRecent }: { showRecent: boolean }) {
  const navigate = useNavigate();
  const { guard, handleAuthError, dialog } = useTokenGate();

  const [builtIn, setBuiltIn] = useState<Persona[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [custom] = useState<Persona[]>(() => {
    const c = loadCustomPersonas();
    return Array.isArray(c) ? c : [];
  });
  const [selected, setSelected] = useState<Set<string>>(new Set()); // keys: "b:<id>" built-in, "c:<id>" custom

  const [target, setTarget] = useState<Target>('demo');
  const [variants, setVariants] = useState<string[]>(['a', 'b']);
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [goal, setGoal] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [successText, setSuccessText] = useState('');
  const [successSelector, setSuccessSelector] = useState('');
  const [repeats, setRepeats] = useState(1);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPersonas()
      .then((p) => { if (alive) { setBuiltIn(p); setSelected(new Set(p.map((x) => `b:${x.id}`))); } })
      .catch((e: unknown) => { if (alive) { setBuiltIn([]); setLoadError(e instanceof Error ? e.message : String(e)); } });
    return () => { alive = false; };
  }, []);

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // Picking a third variant replaces the one chosen longest ago, so exactly two stay selected.
  const toggleVariant = (id: string) => setVariants((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id].slice(-2)));

  const chosenBuiltIn = (builtIn ?? []).filter((p) => selected.has(`b:${p.id}`));
  const chosenCustom = custom.filter((p) => selected.has(`c:${p.id}`));
  const nPersonas = chosenBuiltIn.length + chosenCustom.length;
  const nSessions = nPersonas * 2 * repeats;

  const problem: string | null =
    nPersonas === 0 ? 'Select at least one persona.'
    : chosenCustom.length > 0 && nPersonas > 8 ? 'A run with custom personas takes at most 8 personas. Deselect some.'
    : target === 'demo' && variants.length !== 2 ? 'Choose exactly two demo shop variants to compare.'
    : target === 'site' && (!isUrl(urlA) || !isUrl(urlB)) ? 'Enter a full URL (starting with http:// or https://) for both variants.'
    : target === 'site' && !goal.trim() ? 'Describe the goal the personas should try to complete.'
    : null;

  const buildConfig = (): RunConfig => {
    const config: RunConfig = { repeats };
    if (chosenCustom.length > 0) config.custom_personas = [...chosenBuiltIn, ...chosenCustom];
    else config.persona_ids = chosenBuiltIn.map((p) => p.id);
    if (target === 'demo') {
      config.variants = [...variants].sort();
    } else {
      config.url_a = urlA.trim();
      config.url_b = urlB.trim();
      config.goal = goal.trim();
      config.success_url = successUrl.trim() || null;
      config.success_text = successText.trim() || null;
      config.success_selector = successSelector.trim() || null;
    }
    return config;
  };

  const doStart = async () => {
    setBusy(true); setError(null);
    try {
      const { run_id } = await startRun(buildConfig());
      navigate(`/tools?run=${encodeURIComponent(run_id)}`);
    } catch (e) {
      if (!handleAuthError(e, doStart)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {dialog}
      <form onSubmit={(e) => { e.preventDefault(); if (!problem && !busy) guard(() => { void doStart(); }); }} style={{ display: 'grid', gap: 16 }}>
        <Block n="1" title="Personas" aside={<span className="mono" style={{ fontSize: 12, color: C.muted2 }}>{nPersonas} selected</span>}>
          {builtIn == null && <div style={{ color: C.muted2, fontSize: 13 }}>Loading personas…</div>}
          {loadError && <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>Built-in personas could not be loaded: {loadError}</div>}
          {builtIn != null && builtIn.length > 0 && (
            <>
              <SectionLabel>Built-in</SectionLabel>
              <PersonaGrid personas={builtIn} prefix="b" selected={selected} onToggle={toggle} />
            </>
          )}
          {custom.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>Custom population</SectionLabel>
              <PersonaGrid personas={custom} prefix="c" selected={selected} onToggle={toggle} />
            </div>
          ) : (
            <p style={{ color: C.muted, fontSize: 12, margin: '12px 0 0' }}>
              Need a different audience? <Link to="/populations/new" style={{ color: C.muted2 }}>Generate a custom population</Link> and it will appear here.
            </p>
          )}
        </Block>

        <Block n="2" title="Target">
          <Segmented<Target> label="What to test" value={target} onChange={setTarget} options={[{ value: 'demo', label: 'Demo shop' }, { value: 'site', label: 'Your site' }]} />

          {target === 'demo' ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: C.muted2, marginBottom: 8 }}>Choose two variants of the demo coffee shop to compare. The goal is fixed: buy one 250g bag of Ethiopia Yirgacheffe and have it shipped home.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 8 }}>
                {VARIANTS.map((v) => {
                  const on = variants.includes(v.id);
                  return (
                    <button key={v.id} type="button" aria-pressed={on} onClick={() => toggleVariant(v.id)} style={selectStyle(on)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Check on={on} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Variant {v.name}</span>
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: C.muted2, marginTop: 4, paddingLeft: 24 }}>{v.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
                <Field id="pp-url-a" label="URL A"><input id="pp-url-a" className="input mono" type="url" inputMode="url" placeholder="https://example.com/checkout" value={urlA} onChange={(e) => setUrlA(e.target.value)} /></Field>
                <Field id="pp-url-b" label="URL B"><input id="pp-url-b" className="input mono" type="url" inputMode="url" placeholder="https://staging.example.com/checkout" value={urlB} onChange={(e) => setUrlB(e.target.value)} /></Field>
              </div>
              <Field id="pp-goal" label="Goal" hint="Written to the persona, in plain words. They see this and nothing else about the site.">
                <textarea id="pp-goal" className="input" rows={3} placeholder="Sign up for the free plan and create your first project." value={goal} onChange={(e) => setGoal(e.target.value)} style={{ resize: 'vertical' }} />
              </Field>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Completion checks <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span></div>
                <div style={{ fontSize: 12, color: C.muted2, margin: '2px 0 10px' }}>Completion is verified in code against the live page, not taken from the agent's word. A session counts as completed when any check you set matches.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                  <Field id="pp-s-url" label="Success URL contains"><input id="pp-s-url" className="input mono" placeholder="/welcome" value={successUrl} onChange={(e) => setSuccessUrl(e.target.value)} /></Field>
                  <Field id="pp-s-text" label="Success text"><input id="pp-s-text" className="input" placeholder="Your project is ready" value={successText} onChange={(e) => setSuccessText(e.target.value)} /></Field>
                  <Field id="pp-s-sel" label="Success CSS selector"><input id="pp-s-sel" className="input mono" placeholder="[data-test=project-home]" value={successSelector} onChange={(e) => setSuccessSelector(e.target.value)} /></Field>
                </div>
              </div>
            </div>
          )}
        </Block>

        <Block n="3" title="Repeats">
          <Segmented<number> label="Repeats per persona and variant" value={repeats} onChange={setRepeats} options={[1, 2, 3].map((r) => ({ value: r, label: String(r) }))} />
          {repeats < 3 && <p style={{ color: C.muted, fontSize: 12, margin: '10px 0 0' }}>Below 3 repeats per persona and variant, treat results as directional.</p>}
        </Block>

        <div className="card" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 13 }}>
              {nPersonas} {nPersonas === 1 ? 'persona' : 'personas'} × 2 variants × {repeats} {repeats === 1 ? 'repeat' : 'repeats'} = <span style={{ color: C.green }}>{nSessions} sessions</span>, each in its own Modal container
            </div>
            {problem && <div style={{ fontSize: 12, color: C.yellow, marginTop: 6 }}>{problem}</div>}
            {error && <div role="alert" style={{ fontSize: 12, color: C.red, marginTop: 6 }}>Could not start the run: {error}</div>}
          </div>
          <button type="submit" className="btn-primary" disabled={busy || problem != null} style={{ padding: '9px 20px' }}>{busy ? 'Starting…' : 'Start run'}</button>
        </div>
      </form>

      {showRecent && <RecentRuns />}
    </div>
  );
}

function RecentRuns() {
  const { runs, error } = useRuns();
  return (
    <div style={{ marginTop: 32 }}>
      <SectionLabel>Recent runs</SectionLabel>
      {error && !runs && <div role="alert" style={{ color: C.red, fontSize: 13 }}>Runs could not be loaded: {error}</div>}
      {!runs && !error && <div style={{ color: C.muted2, fontSize: 13 }}>Loading…</div>}
      {runs && runs.length === 0 && <div className="card" style={{ padding: 16, color: C.muted2, fontSize: 13 }}>No runs yet. The first one you start will show up here.</div>}
      {runs && runs.length > 0 && (
        <ul className="card" style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'hidden' }}>
          {runs.slice(0, 5).map((r, i) => (
            <li key={r.run_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', padding: '10px 14px', borderTop: i ? `1px solid ${C.border}` : undefined }}>
              <span className="mono" style={{ fontSize: 12 }}>{r.run_id}</span>
              <RunStatusTag status={r.status} />
              <span style={{ fontSize: 12, color: C.muted2 }}>
                {[fmtTime(r.created_at), r.sessions != null ? `${r.sessions} sessions` : '', r.winner ? (r.winner.length <= 2 ? `winner ${r.winner.toUpperCase()}` : r.winner) : '', r.tokens ? `${fmtTokens(r.tokens)} tokens` : ''].filter(Boolean).join(' · ')}
              </span>
              <span style={{ flex: 1 }} />
              <Link to={`/tools?run=${r.run_id}`} className="btn-secondary" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 12px' }}>Monitor</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Block({ n, title, aside, children }: { n: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 11, color: C.muted }}>{n}</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
        <span style={{ flex: 1 }} />
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, color: C.muted2, marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Segmented<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 3, gap: 2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, maxWidth: '100%' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" aria-pressed={on} onClick={() => onChange(o.value)} style={{
            padding: '6px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: on ? C.surface2 : 'transparent', color: on ? C.text : C.muted2, boxShadow: on ? `inset 0 0 0 1px ${C.border2}` : undefined,
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

const selectStyle = (on: boolean): CSSProperties => ({
  textAlign: 'left', padding: 12, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: C.text, minWidth: 0,
  background: on ? 'rgba(74,222,128,0.06)' : C.bg, border: `1px solid ${on ? 'rgba(74,222,128,0.5)' : C.border}`,
});

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" style={{ flex: 'none', width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? C.green : 'transparent', border: `1px solid ${on ? C.green : C.border2}` }}>
      {on && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.2 4.2 7.4 8 3" stroke={C.bg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
  );
}

function PersonaGrid({ personas, prefix, selected, onToggle }: { personas: Persona[]; prefix: 'b' | 'c'; selected: Set<string>; onToggle: (key: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 8 }}>
      {personas.map((p) => {
        const key = `${prefix}:${p.id}`;
        const on = selected.has(key);
        return (
          <button key={key} type="button" aria-pressed={on} onClick={() => onToggle(key)} style={selectStyle(on)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check on={on} />
              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </span>
            <span className="mono" style={{ display: 'block', fontSize: 11, color: C.muted2, marginTop: 6 }}>
              {p.device} · {p.tech_savviness} savviness · {p.patience_steps} actions of patience
            </span>
            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, color: C.muted2, marginTop: 6, lineHeight: 1.45 }}>{firstLine(p.bio ?? '')}</span>
          </button>
        );
      })}
    </div>
  );
}
