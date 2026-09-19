// Customer data in, agents out: read a CSV in the browser, show who is in it, pick a small
// representative panel, and turn those customers into personas.
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { personasFromRows, type Persona } from '../../lib/api';
import { breakdown, mapsDirectly, parseCsv, recognisedColumns, representativeSample, type CsvTable } from '../../lib/csv';
import { C, Tag, useTokenGate } from '../../lib/ui';
import { Avatar, PreviewCard } from './PersonaBits';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PANEL = 10;
const SIZES = [3, 6, 8, 10];
const LIST_LIMIT = 40;

type Phase = 'drop' | 'review' | 'creating' | 'done';
type Row = Record<string, string>;

const colKey = (t: CsvTable, name: string) => t.columns.find((c) => c.toLowerCase() === name);
const deviceOf = (viewport: string | undefined): string => {
  const w = parseInt((viewport ?? '').split(/[x×]/i)[0] ?? '', 10);
  return Number.isFinite(w) ? (w < 600 ? 'mobile' : 'desktop') : 'unknown';
};

/** A fresh representative sample that avoids rows already shown, so "pick different" really is different. */
function sampleAvoiding(t: CsvTable, n: number, avoid: Set<number>): number[] {
  const keep = t.rows.map((_, i) => i).filter((i) => !avoid.has(i));
  if (keep.length < n) return representativeSample(t, n);
  const sub: CsvTable = { ...t, rows: keep.map((i) => t.rows[i]!) };
  return representativeSample(sub, n).map((i) => keep[i]!);
}

function Bars({ title, items, total }: { title: string; items: { value: string; count: number }[]; total: number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.muted2, marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {items.slice(0, 6).map((it) => (
          <li key={it.value} style={{ display: 'grid', gridTemplateColumns: 'minmax(64px, 0.8fr) minmax(40px, 1.6fr) 72px', gap: 10, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{it.value}</span>
            <span aria-hidden="true" style={{ height: 3, background: C.border2, borderRadius: 2 }}><span style={{ display: 'block', height: '100%', width: `${(it.count / Math.max(1, total)) * 100}%`, minWidth: 3, background: C.green, borderRadius: 2 }} /></span>
            <span className="mono" style={{ fontSize: 11, color: C.muted2, textAlign: 'right' }}>{it.count} · {Math.round((it.count / Math.max(1, total)) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Upload({ onSave, onDone }: { onSave: (personas: Persona[]) => void; onDone: () => void }) {
  const { guard, handleAuthError, dialog } = useTokenGate();
  const inputId = useId();
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('drop');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState(6);
  const [selected, setSelected] = useState<number[]>([]);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [browse, setBrowse] = useState(false);
  const [result, setResult] = useState<{ method: 'mapped' | 'personified'; personas: Persona[] } | null>(null);
  const [filled, setFilled] = useState(0);

  const readFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError('');
    if (file.size > MAX_BYTES) { setError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB. Export fewer rows and try again.`); return; }
    if (!/\.csv$/i.test(file.name) && !/csv|text\/plain/i.test(file.type)) { setError(`${file.name} does not look like a CSV file. Export your data as CSV, one customer per row.`); return; }
    try {
      const t = parseCsv(await file.text(), file.name);
      if (t.columns.length === 0 || t.rows.length === 0) { setError(`${file.name} has no data rows. It needs a header row and at least one customer.`); return; }
      const n = Math.min(6, t.rows.length);
      const first = representativeSample(t, n);
      setTable(t); setSize(6); setSelected(first); setShown(new Set(first)); setQuery(''); setBrowse(false); setResult(null); setPhase('review');
    } catch { setError(`${file.name} could not be read. Check that it is a plain CSV file.`); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files[0]); };
  const reset = () => { setTable(null); setSelected([]); setResult(null); setError(''); setPhase('drop'); if (inputRef.current) inputRef.current.value = ''; };

  const nameKey = table ? colKey(table, 'name') : undefined;
  const label = (i: number) => (table && nameKey && table.rows[i]?.[nameKey]) || `Row ${i + 1}`;
  const field = (row: Row | undefined, name: string) => (table && row ? row[colKey(table, name) ?? ''] ?? '' : '');

  const resample = (n: number, avoid: Set<number>) => {
    if (!table) return;
    const next = sampleAvoiding(table, Math.min(n, table.rows.length), avoid);
    setSelected(next); setShown(new Set([...(avoid.size + next.length > table.rows.length ? [] : avoid), ...next]));
  };
  const toggle = (i: number) => setSelected((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= MAX_PANEL ? cur : [...cur, i].sort((a, b) => a - b)));

  const create = () => {
    if (!table || selected.length === 0) return;
    const rows = selected.map((i) => table.rows[i]!);
    const numbers = selected.map((i) => i + 1);
    guard(async () => {
      setError(''); setResult(null); setFilled(0); setPhase('creating');
      try {
        const res = await personasFromRows(rows, numbers, table.filename);
        if (!Array.isArray(res.personas) || res.personas.length === 0) throw new Error('No personas came back for these customers.');
        onSave(res.personas);
        setResult(res);
      } catch (e) {
        setPhase('review');
        if (!handleAuthError(e, create)) setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // The avatars fill in one by one. Slow while we wait, quick once the answer is back (under 2 s for 10).
  useEffect(() => {
    if (phase !== 'creating') return;
    const n = selected.length;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (result && (filled >= n || reduce)) { setPhase('done'); return; }
    const id = setTimeout(() => setFilled((f) => Math.min(f + 1, result ? n : n - 1)), result ? 150 : 600);
    return () => clearTimeout(id);
  }, [phase, result, filled, selected.length]);

  const stats = useMemo(() => {
    if (!table) return null;
    const recognised = recognisedColumns(table);
    const vKey = colKey(table, 'viewport');
    const devices = new Map<string, number>();
    if (vKey) for (const r of table.rows) { const d = deviceOf(r[vKey]); devices.set(d, (devices.get(d) ?? 0) + 1); }
    return {
      recognised, other: table.columns.filter((c) => !recognised.includes(c)), direct: mapsDirectly(table),
      savviness: breakdown(table, 'tech_savviness'),
      devices: [...devices].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    };
  }, [table]);

  const matches = useMemo(() => {
    if (!table) return [];
    const q = query.trim().toLowerCase();
    const all = table.rows.map((_, i) => i);
    return q ? all.filter((i) => Object.values(table.rows[i]!).some((v) => v.toLowerCase().includes(q))) : all;
  }, [table, query]);

  // ---------- 1. drop zone ----------
  if (phase === 'drop' || !table || !stats) {
    return (
      <div>
        {dialog}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          style={{ padding: '40px 20px', borderRadius: 10, textAlign: 'center', border: `1.5px dashed ${dragging ? C.green : C.border2}`, background: dragging ? 'rgba(74,222,128,0.05)' : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}
        >
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}>
            <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Drop your CSV file here</div>
          <div style={{ fontSize: 13, color: C.muted2, marginTop: 4 }}>CSV, one customer per row · up to 5 MB</div>
          <input ref={inputRef} id={inputId} type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
          <label htmlFor={inputId} className="btn-secondary pp-file-label" style={{ display: 'inline-block', marginTop: 16 }}>Choose file</label>
          <p style={{ margin: '16px auto 0', maxWidth: 520, fontSize: 12, lineHeight: 1.55, color: C.muted }}>
            The file is read in this browser. Only the customers you choose for the panel are sent to the server. Columns named name, bio, goals, frustrations, tech_savviness, patience_steps, viewport and reading_style are used as they are.
          </p>
        </div>
        {error && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  const total = table.rows.length;

  // ---------- 4. creating / done ----------
  if (phase === 'creating' || phase === 'done') {
    const n = selected.length;
    const done = phase === 'done' && result;
    return (
      <div className="card" style={{ padding: 'clamp(20px, 4vw, 28px)' }}>
        {dialog}
        <div role="status" aria-live="polite">
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: done ? C.green : C.yellow, display: 'flex', gap: 8, alignItems: 'center' }}>
            {!done && <span className="dot-yellow" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
            {done ? 'Agents ready' : 'Orchestrator'}
          </div>
          <h3 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {done ? `${result.personas.length} ${result.personas.length === 1 ? 'agent' : 'agents'} created from your customers` : `Creating ${n} sandboxed ${n === 1 ? 'agent' : 'agents'} from your customers…`}
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: C.muted2, maxWidth: 680 }}>
            {done
              ? result.method === 'mapped'
                ? 'Your columns were mapped directly onto each persona in code. No AI was used, so this cost nothing. They are saved in this browser and tagged custom.'
                : 'Gemini read each customer row and wrote a persona for it. They are saved in this browser and tagged custom.'
              : stats.direct ? 'Mapping each customer onto a persona: background, goals, frustrations, screen size and patience.' : 'Gemini is reading each customer row and writing a persona for it. This can take 10 to 20 seconds.'}
          </p>
        </div>
        {!done && (
          <ul aria-hidden="true" style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {selected.map((i, k) => {
              const on = k < filled;
              return (
                <li key={i} style={{ width: 72, textAlign: 'center', opacity: on ? 1 : 0.3, transition: 'opacity 0.3s' }}>
                  <span style={{ display: 'inline-flex', borderRadius: '50%', padding: 2, border: `1.5px ${on ? 'solid' : 'dashed'} ${on ? C.green : C.border2}` }}><Avatar name={label(i)} size={40} /></span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(i)}</span>
                </li>
              );
            })}
          </ul>
        )}
        {done && (
          <>
            <ul style={{ margin: '20px 0 0', padding: 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
              {result.personas.map((p) => <PreviewCard key={p.id} persona={p} />)}
            </ul>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
              <Link to="/new?panel=custom" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 18px' }}>Test with these agents</Link>
              <button type="button" className="btn-secondary" onClick={() => { reset(); onDone(); }}>Back to personas</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ---------- 2 + 3. validation and panel ----------
  const full = selected.length >= MAX_PANEL;
  const customerRow = (i: number, checked: boolean) => {
    const row = table.rows[i];
    const goal = field(row, 'goals').split(/[;|]/)[0]?.trim();
    const cbId = `${inputId}-row-${i}`;
    return (
      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: checked ? C.bg : 'transparent', border: `1px solid ${checked ? C.border : 'transparent'}`, minWidth: 0 }}>
        <input id={cbId} type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggle(i)} style={{ accentColor: C.green, width: 16, height: 16, flexShrink: 0 }} />
        <Avatar name={label(i)} size={30} />
        <label htmlFor={cbId} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0 8px', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{label(i)}</span>
            <span className="mono" style={{ fontSize: 11, color: C.muted }}>
              row {i + 1}{field(row, 'tech_savviness') && ` · ${field(row, 'tech_savviness').toLowerCase()} savviness`}{field(row, 'viewport') && ` · ${field(row, 'viewport')}`}
            </span>
          </span>
          {goal && <span style={{ display: 'block', fontSize: 12, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Wants to {goal.replace(/^to\s+/i, '')}</span>}
        </label>
      </li>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {dialog}
      <section aria-label="File check" className="card" style={{ padding: 20, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.green }}>File read</div>
            <h3 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{table.filename}</h3>
            <div className="mono" style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{total} {total === 1 ? 'customer' : 'customers'} · {table.columns.length} columns</div>
          </div>
          <button type="button" className="btn-ghost" onClick={reset}>Use a different file</button>
        </div>

        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 6, fontSize: 13, lineHeight: 1.5, background: stats.direct ? 'rgba(74,222,128,0.06)' : 'rgba(250,204,21,0.06)', border: `1px solid ${stats.direct ? 'rgba(74,222,128,0.25)' : 'rgba(250,204,21,0.25)'}` }}>
          {stats.direct
            ? <><b style={{ color: C.green, fontWeight: 600 }}>Mapped directly, no AI cost.</b> The file has name and bio columns, so each row becomes a persona in code.</>
            : <><b style={{ color: C.yellow, fontWeight: 600 }}>Interpreted by Gemini.</b> There are no name and bio columns, so a model reads each chosen row and writes the persona. Only the rows in your panel are sent.</>}
        </div>

        <div style={{ display: 'grid', gap: '12px 24px', marginTop: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Recognised columns · {stats.recognised.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {stats.recognised.length ? stats.recognised.map((c) => <Tag key={c} tone="green"><span className="mono">{c}</span></Tag>) : <span style={{ fontSize: 12, color: C.muted2 }}>None of the standard persona columns were found.</span>}
            </div>
          </div>
          {stats.other.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{stats.direct ? 'Ignored' : 'Interpreted by Gemini'} · {stats.other.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{stats.other.map((c) => <Tag key={c}><span className="mono">{c}</span></Tag>)}</div>
            </div>
          )}
        </div>

        <h4 style={{ margin: '22px 0 12px', fontSize: 14, fontWeight: 600 }}>Who is in this file</h4>
        {(stats.savviness.length > 0 || stats.devices.length > 0) && (
          <div style={{ display: 'grid', gap: '16px 32px', marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
            {stats.savviness.length > 0 && <Bars title="Tech savviness" items={stats.savviness} total={total} />}
            {stats.devices.length > 0 && <Bars title="Device, from viewport width (under 600 px is mobile)" items={stats.devices} total={total} />}
          </div>
        )}
        <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }} tabIndex={0} role="region" aria-label="First rows of the file">
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <caption style={{ captionSide: 'bottom', textAlign: 'left', padding: '8px 10px', fontSize: 11, color: C.muted }}>First {Math.min(8, total)} of {total} rows. Long values are cut short here, not in the data.</caption>
            <thead><tr>{table.columns.map((c) => <th key={c} scope="col" className="mono" style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: stats.recognised.includes(c) ? C.green : C.muted2, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
            <tbody>
              {table.rows.slice(0, 8).map((r, i) => (
                <tr key={i}>{table.columns.map((c) => <td key={c} title={r[c]} style={{ padding: '7px 10px', color: C.muted2, borderBottom: `1px solid ${C.border}`, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[c]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Choose the panel" className="card" style={{ padding: 20, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Choose the panel</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.55, color: C.muted2 }}>We run small panels. A representative sample mirrors the mix in your file.</p>
          </div>
          <div role="group" aria-label="Panel size" style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {SIZES.map((n) => {
              const on = size === n;
              return <button key={n} type="button" aria-pressed={on} disabled={n > total && n !== SIZES[0]} onClick={() => { setSize(n); resample(n, new Set()); }} className="mono" style={{ width: 44, height: 32, fontSize: 13, cursor: 'pointer', border: 'none', background: on ? 'rgba(74,222,128,0.12)' : 'transparent', color: on ? C.green : C.muted2 }}>{n}</button>;
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
          <div aria-live="polite" style={{ fontSize: 12, color: C.muted2 }}><b style={{ color: C.text, fontWeight: 600 }}>{selected.length} selected</b> · {MAX_PANEL} at most. Untick anyone you do not want.</div>
          <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => resample(size, shown)} disabled={total <= size}>Pick different customers</button>
        </div>
        {selected.length === 0
          ? <div style={{ padding: 16, fontSize: 13, color: C.muted2, border: `1px dashed ${C.border2}`, borderRadius: 6 }}>Nobody is selected. Pick a sample again, or tick customers from the full list below.</div>
          : <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))' }}>{selected.map((i) => customerRow(i, true))}</ul>}

        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn-ghost" aria-expanded={browse} onClick={() => setBrowse(!browse)} style={{ paddingLeft: 0, fontSize: 13 }}>{browse ? 'Hide' : 'Browse'} all {total} customers</button>
          {browse && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor={searchId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search all customers</label>
              <input id={searchId} className="input" type="search" placeholder="Search any column, for example a name, a city or a product" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 420 }} />
              <div style={{ fontSize: 11, color: C.muted, margin: '8px 0' }}>
                {matches.length} {matches.length === 1 ? 'customer matches' : 'customers match'}{matches.length > LIST_LIMIT && `, showing the first ${LIST_LIMIT}`}.{full && ' The panel is full. Untick someone to add another.'}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 2, maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
                {matches.slice(0, LIST_LIMIT).map((i) => customerRow(i, selected.includes(i)))}
                {matches.length === 0 && <li style={{ padding: 16, fontSize: 13, color: C.muted2 }}>No customer matches that search.</li>}
              </ul>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <button type="button" className="btn-primary" disabled={selected.length === 0} onClick={create} style={{ padding: '9px 18px' }}>Create {selected.length} {selected.length === 1 ? 'agent' : 'agents'}</button>
          <span style={{ fontSize: 12, color: C.muted2, flex: '1 1 220px' }}>{stats.direct ? 'Needs sign-in. No AI is used for this file, so it costs nothing.' : 'Needs sign-in, because Gemini writes these personas.'}</span>
        </div>
        {error && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 12 }}>Could not create the agents: {error}</div>}
      </section>
    </div>
  );
}
