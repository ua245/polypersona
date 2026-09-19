// New test: one screen, three decisions (what to compare, who tests it, a name), one button.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { fmtTokens, getPersonas, loadCustomPersonas, startRun, type Persona, type RunConfig } from '../lib/api';
import { testPath } from '../lib/derive';
import { C, useTokenGate } from '../lib/ui';
import { CheckCircle, Eyebrow, Field } from './newtest/bits';
import PersonaPicker, { PersonaDetail, type PickablePersona } from './newtest/PersonaPicker';

type Compare = 'dark' | 'redesign' | 'site';
const COMPARE: { id: Compare; title: string; blurb: string; tag: string; variants?: string[]; autoName: string }[] = [
  { id: 'dark', title: 'Clean vs dark patterns', tag: 'Demo shop · A vs B', variants: ['a', 'b'], autoName: 'Checkout: clean vs dark patterns',
    blurb: 'A clean guest checkout against one with a popup, forced account, a hidden fee and a real bug.' },
  { id: 'redesign', title: 'Clean vs redesign', tag: 'Demo shop · A vs C', variants: ['a', 'c'], autoName: 'Checkout: clean vs redesign',
    blurb: 'A subtler call: a faster redesign that pre-ticks a subscription.' },
  { id: 'site', title: 'Your own site', tag: 'Any two URLs', autoName: 'My site: A vs B',
    blurb: 'Point the panel at two live URLs and tell them what to try to do.' },
];
const DEMO_GOAL = 'buy one 250g bag of Ethiopia Yirgacheffe coffee and have it shipped home.';
const MAX_PERSONAS = 10; // the API runs at most 10 personas per test

const isUrl = (v: string) => /^https?:\/\/(localhost|\S+\.\S+)/i.test(v.trim());
const host = (u: string) => { try { return new URL(u.trim()).host; } catch { return ''; } };

export default function NewTest() {
  const navigate = useNavigate();
  const { guard, handleAuthError, dialog } = useTokenGate();

  const [builtIn, setBuiltIn] = useState<Persona[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [custom] = useState<Persona[]>(() => { const c = loadCustomPersonas(); return Array.isArray(c) ? c : []; });
  const [selected, setSelected] = useState<Set<string>>(new Set()); // "b:<id>" built-in, "c:<id>" custom

  const [compare, setCompare] = useState<Compare>('dark');
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [goal, setGoal] = useState('');
  const [successText, setSuccessText] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [successSelector, setSuccessSelector] = useState('');
  const [typedName, setTypedName] = useState<string | null>(null); // null = follow the automatic name
  const [repeats, setRepeats] = useState(1);

  const [shownKey, setShownKey] = useState<string | null>(null); // persona whose bio is on show (hover or focus)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // The full built-in panel is preselected: three very different people make the best first test.
    getPersonas()
      .then((p) => {
        if (!alive) return;
        setBuiltIn(p);
        // Arriving from "Test with these agents" (/new?panel=custom): the uploaded or generated panel is preselected instead.
        const wantCustom = new URLSearchParams(window.location.search).get('panel') === 'custom' && custom.length > 0;
        setSelected(new Set(wantCustom ? custom.slice(0, MAX_PERSONAS).map((x) => `c:${x.id}`) : p.slice(0, 3).map((x) => `b:${x.id}`)));
      })
      .catch((e: unknown) => { if (alive) { setBuiltIn([]); setLoadError(e instanceof Error ? e.message : String(e)); } });
    return () => { alive = false; };
  }, []);

  const people: PickablePersona[] = useMemo(() => [
    ...(builtIn ?? []).map((persona) => ({ key: `b:${persona.id}`, persona, custom: false })),
    ...custom.map((persona) => ({ key: `c:${persona.id}`, persona, custom: true })),
  ], [builtIn, custom]);
  const shown = people.find((x) => x.key === shownKey)?.persona ?? null;
  const chosen = people.filter((x) => selected.has(x.key));
  const toggle = (key: string) => setSelected((prev) => { const next = new Set(prev); if (!next.delete(key)) next.add(key); return next; });

  const choice = COMPARE.find((c) => c.id === compare)!;
  const autoName = compare === 'site' && host(urlA) && host(urlB) ? `${host(urlA)} vs ${host(urlB)}` : choice.autoName;
  const name = typedName ?? autoName;

  const compareProblem = compare !== 'site' ? null
    : !isUrl(urlA) || !isUrl(urlB) ? 'Enter both URLs, starting with https://'
    : !goal.trim() ? 'Say what each person should try to do'
    : null;
  const whoProblem = builtIn == null ? 'Loading personas…'
    : chosen.length === 0 ? 'Pick at least one persona'
    : chosen.length > MAX_PERSONAS ? `Pick at most ${MAX_PERSONAS} personas`
    : null;
  const nameProblem = name.trim() ? null : 'Give the test a name';
  const problem = compareProblem ?? whoProblem ?? nameProblem;

  const agents = chosen.length * 2 * repeats;
  const minutes = agents <= 6 ? 'about 3 minutes' : 'about 4 minutes';

  const buildConfig = (): RunConfig => {
    const config: RunConfig = { name: name.trim(), repeats };
    if (chosen.some((x) => x.custom)) config.custom_personas = chosen.map((x) => x.persona).slice(0, MAX_PERSONAS);
    else config.persona_ids = chosen.map((x) => x.persona.id);
    if (choice.variants) config.variants = choice.variants;
    else {
      config.url_a = urlA.trim(); config.url_b = urlB.trim(); config.goal = goal.trim();
      config.success_text = successText.trim() || null;
      config.success_url = successUrl.trim() || null;
      config.success_selector = successSelector.trim() || null;
    }
    return config;
  };

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const { run_id } = await startRun(buildConfig());
      navigate(testPath(run_id));
    } catch (e) {
      if (!handleAuthError(e, () => { void start(); })) setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const checklist: { label: string; ok: boolean; detail: string }[] = [
    { label: 'What to compare', ok: compareProblem == null, detail: compareProblem ?? (compare === 'site' ? `${host(urlA)} vs ${host(urlB)}` : choice.title) },
    { label: 'Who tests it', ok: whoProblem == null, detail: whoProblem ?? chosen.map((x) => x.persona.name.split(' ')[0]).join(', ') },
    { label: 'Name', ok: nameProblem == null, detail: nameProblem ?? name.trim() },
  ];

  return (
    <div>
      <style>{CSS}</style>
      {dialog}
      <div className="nt-wrap">
        <div className="nt-grid">
          <aside className="nt-side">
            <Eyebrow>New test</Eyebrow>
            <h1 style={{ margin: '14px 0 12px', fontSize: 'clamp(28px, 4vw, 34px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Set up your test</h1>
            <p style={{ margin: 0, color: C.muted2, fontSize: 15, lineHeight: 1.6 }}>
              Each persona uses both variants in a real browser, thinking out loud. You watch them live, then get a verdict with screenshots.
            </p>
            <ol aria-label="Decisions" className="nt-checklist">
              {checklist.map((c) => (
                <li key={c.label}>
                  <span style={{ marginTop: 2 }}><CheckCircle on={c.ok} size={18} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: c.ok ? C.text : C.muted2 }}>{c.label}<span style={{ position: 'absolute', left: -9999 }}>{c.ok ? ' (done)' : ' (to do)'}</span></span>
                    <span className="nt-check-detail" style={{ color: c.ok ? C.muted : C.yellow }}>{c.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="nt-detail-side" aria-hidden="true">{shown && <PersonaDetail p={shown} />}</div>
          </aside>

          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'grid', gap: 36, minWidth: 0 }}>
            <Section n="1" title="What to compare">
              <div role="radiogroup" aria-label="What to compare" className="nt-cards">
                {COMPARE.map((c) => (
                  <label key={c.id} className="nt-radio" data-on={compare === c.id}>
                    <input type="radio" name="nt-compare" value={c.id} checked={compare === c.id} onChange={() => setCompare(c.id)} />
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: compare === c.id ? C.green : C.muted }}>{c.tag}</span>
                      <RadioDot on={compare === c.id} />
                    </span>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, marginTop: 14, letterSpacing: '-0.01em' }}>{c.title}</span>
                    <span style={{ display: 'block', fontSize: 13, color: C.muted2, marginTop: 6, lineHeight: 1.5 }}>{c.blurb}</span>
                  </label>
                ))}
              </div>

              {compare !== 'site' ? (
                <p style={{ margin: '14px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}><span style={{ color: C.muted2 }}>Goal:</span> {DEMO_GOAL}</p>
              ) : (
                <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
                    <Field id="nt-url-a" label="URL A"><input id="nt-url-a" className="input mono nt-input" type="url" inputMode="url" placeholder="https://example.com/checkout" value={urlA} onChange={(e) => setUrlA(e.target.value)} /></Field>
                    <Field id="nt-url-b" label="URL B"><input id="nt-url-b" className="input mono nt-input" type="url" inputMode="url" placeholder="https://staging.example.com/checkout" value={urlB} onChange={(e) => setUrlB(e.target.value)} /></Field>
                  </div>
                  <Field id="nt-goal" label="What should each person try to do?" hint="Written to the persona in plain words. It is all they know about the site.">
                    <textarea id="nt-goal" className="input nt-input" rows={3} placeholder="Sign up for the free plan and create your first project." value={goal} onChange={(e) => setGoal(e.target.value)} style={{ resize: 'vertical' }} />
                  </Field>
                  <Field id="nt-s-text" label="Text that appears when they succeed" hint="Optional. Success is checked in code against the live page, not taken from the agent's word.">
                    <input id="nt-s-text" className="input nt-input" placeholder="Your project is ready" value={successText} onChange={(e) => setSuccessText(e.target.value)} />
                  </Field>
                  <details className="nt-details">
                    <summary>Advanced success checks</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, marginTop: 12 }}>
                      <Field id="nt-s-url" label="Success URL contains"><input id="nt-s-url" className="input mono nt-input" placeholder="/welcome" value={successUrl} onChange={(e) => setSuccessUrl(e.target.value)} /></Field>
                      <Field id="nt-s-sel" label="CSS selector"><input id="nt-s-sel" className="input mono nt-input" placeholder="[data-test=project-home]" value={successSelector} onChange={(e) => setSuccessSelector(e.target.value)} /></Field>
                    </div>
                  </details>
                </div>
              )}
            </Section>

            <Section n="2" title="Who tests it" aside={<span className="mono" style={{ fontSize: 12, color: C.muted2 }}>{chosen.length} selected</span>}>
              {builtIn == null && <div style={{ color: C.muted2, fontSize: 13 }}>Loading personas…</div>}
              {loadError && <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>The built-in personas could not be loaded: {loadError}</div>}
              {people.length > 0 && <PersonaPicker people={people} selected={selected} onToggle={toggle} shown={shown} onShow={setShownKey} />}
              <p style={{ margin: '12px 0 0', fontSize: 13 }}><Link to="/personas" className="nt-link">Create more personas</Link></p>
            </Section>

            <Section n="3" title="Name">
              <label htmlFor="nt-name" style={{ position: 'absolute', left: -9999 }}>Test name</label>
              <input id="nt-name" className="input nt-input" value={name} maxLength={80} onChange={(e) => setTypedName(e.target.value)} />
              {typedName != null && typedName !== autoName && (
                <button type="button" className="nt-link" onClick={() => setTypedName(null)} style={{ marginTop: 8, fontSize: 12 }}>Use the suggested name</button>
              )}
            </Section>

            <details className="nt-details">
              <summary>Advanced</summary>
              <div style={{ marginTop: 14 }}>
                <div id="nt-repeats-label" style={{ fontSize: 12, color: C.muted2, marginBottom: 6 }}>Repeats per persona and variant</div>
                <div role="radiogroup" aria-labelledby="nt-repeats-label" style={{ display: 'inline-flex', padding: 3, gap: 2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {[1, 2, 3].map((r) => (
                    <label key={r} className="nt-seg" data-on={repeats === r}>
                      <input type="radio" name="nt-repeats" value={r} checked={repeats === r} onChange={() => setRepeats(r)} />{r}
                    </label>
                  ))}
                </div>
                <p style={{ color: C.muted, fontSize: 12, margin: '10px 0 0' }}>Below 3 repeats, treat results as directional.</p>
              </div>
            </details>
          </form>
        </div>
      </div>

      <div className="nt-bar" role="region" aria-label="Summary">
        <div className="nt-bar-in">
          <div style={{ minWidth: 0, flex: '1 1 300px' }}>
            <div className="mono" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {chosen.length} {chosen.length === 1 ? 'persona' : 'personas'} × 2 variants{repeats > 1 ? ` × ${repeats} repeats` : ''} = <span style={{ color: C.green }}>{agents} {agents === 1 ? 'agent' : 'agents'}</span>
              {agents > 0 && <span style={{ color: C.muted2 }}> · {minutes} · ~{fmtTokens(agents * 150000)} Gemini tokens</span>}
            </div>
            <div aria-live="polite" className="nt-bar-msg">
              {error ? <span role="alert" style={{ color: C.red }}>Could not start the test: {error}</span>
                : problem ? <span style={{ color: C.yellow }}>{problem}</span>
                : <span className="nt-bar-note" style={{ color: C.muted }}>Every agent gets its own browser in its own container. You will land on the live view.</span>}
            </div>
          </div>
          <button type="button" className="btn-primary nt-start" disabled={busy || problem != null} onClick={() => guard(() => { void start(); })}>
            {busy ? 'Starting…' : 'Start test'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ n, title, aside, children }: { n: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 11, color: C.green }}>{n}</span>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
        <span style={{ flex: 1 }} />
        {aside}
      </div>
      {children}
    </section>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" style={{ flex: 'none', width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${on ? C.green : C.border2}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green }} />}
    </span>
  );
}

const CSS = `
.nt-wrap { max-width: 1040px; margin: 0 auto; padding: 56px 24px 140px; }
.nt-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 72px; align-items: start; }
.nt-side { position: sticky; top: 96px; }
.nt-checklist { list-style: none; margin: 32px 0 0; padding: 0; display: grid; gap: 18px; }
.nt-checklist li { display: flex; gap: 12px; align-items: flex-start; }
.nt-check-detail { display: block; font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
.nt-detail-side { margin-top: 28px; }
.nt-detail-inline { display: none; margin-top: 10px; }
.nt-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.nt-radio { display: block; position: relative; padding: 16px; border-radius: 10px; cursor: pointer; background: #111318; border: 1px solid #1e2230; transition: border-color 0.15s, background 0.15s; min-width: 0; }
.nt-radio:hover { border-color: #252a38; }
.nt-radio[data-on="true"] { border-color: #4ade80; background: rgba(74,222,128,0.05); }
.nt-radio input, .nt-seg input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.nt-radio:has(input:focus-visible), .nt-seg:has(input:focus-visible) { outline: 2px solid #4ade80; outline-offset: 2px; }
.nt-pick { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px 14px; border-radius: 10px; cursor: pointer; font-family: inherit; color: #e8eaf0; min-width: 0; background: #111318; border: 1px solid #1e2230; transition: border-color 0.15s, background 0.15s; }
.nt-pick:hover { border-color: #252a38; }
.nt-pick[data-on="true"] { border-color: rgba(74,222,128,0.55); background: rgba(74,222,128,0.05); }
.nt-input { font-size: 14px; padding: 10px 12px; }
.nt-link { color: #9ca3af; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #252a38; }
.nt-link:hover { color: #e8eaf0; }
.nt-details summary { cursor: pointer; font-size: 13px; color: #9ca3af; width: fit-content; border-radius: 4px; }
.nt-details summary:hover { color: #e8eaf0; }
.nt-details summary:focus-visible { outline: 2px solid #4ade80; outline-offset: 2px; }
.nt-seg { position: relative; padding: 6px 18px; font-size: 13px; font-weight: 500; border-radius: 6px; cursor: pointer; color: #9ca3af; }
.nt-seg[data-on="true"] { background: #181b22; color: #e8eaf0; box-shadow: inset 0 0 0 1px #252a38; }
.nt-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 90; background: rgba(9,9,14,0.92); backdrop-filter: blur(8px); border-top: 1px solid #1e2230; }
.nt-bar-in { max-width: 1040px; margin: 0 auto; padding: 14px 24px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; }
.nt-bar-msg { font-size: 12px; margin-top: 2px; min-height: 16px; }
.nt-start { padding: 11px 28px; font-size: 14px; }
@media (max-width: 900px) {
  .nt-wrap { padding: 32px 16px 200px; }
  .nt-grid { grid-template-columns: minmax(0, 1fr); gap: 36px; }
  .nt-side { position: static; }
  .nt-checklist { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 8px 18px; }
  .nt-checklist li { gap: 8px; align-items: center; }
  .nt-check-detail, .nt-detail-side, .nt-bar-note { display: none; }
  .nt-detail-inline { display: block; }
.nt-cards { grid-template-columns: minmax(0, 1fr); }
  .nt-bar-in { padding: 12px 16px; }
  .nt-bar-msg { min-height: 0; }
  .nt-start { width: 100%; }
}
`;
