import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  fmtTime, getPersonas, loadCustomPersonas, sessionList, useRun, useRuns, useSelectedRunId,
  type Device, type Persona, type SessionState,
} from '../lib/api';
import { C, Empty, Page, PatienceBar, RunBar, RunStatusTag, Screenshot, SectionLabel, SessionTag, Tag } from '../lib/ui';

type StateFilter = 'all' | 'running' | 'completed' | 'not_completed';
type DeviceFilter = 'all' | Device;

const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'not_completed', label: 'Not completed' },
];
const DEVICE_OPTIONS: { value: DeviceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
];

const matchesState = (s: SessionState, f: StateFilter): boolean => {
  if (f === 'all') return true;
  if (f === 'running') return s.status === 'running';
  if (f === 'completed') return s.outcome === 'completed';
  return s.outcome != null && s.outcome !== 'completed';
};

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span className="mono" style={{ color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              style={{
                background: on ? C.surface2 : 'transparent', color: on ? C.text : C.muted2, border: 'none',
                padding: '5px 11px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgentTile({ runId, s }: { runId: string; s: SessionState }) {
  const steps = s.steps ?? [];
  const observations = s.observations ?? [];
  const last = steps.length ? steps[steps.length - 1] : null;
  const used = Math.max(0, (s.patience ?? 0) - (s.actions_left ?? 0));
  const negatives = observations.filter((o) => o.kind !== 'delight' && o.kind !== 'opinion');
  const worst = negatives.reduce((m, o) => Math.max(m, o.severity), 0);
  return (
    <Link
      to={`/populations/${encodeURIComponent(s.session_id)}?run=${encodeURIComponent(runId)}`}
      className="card"
      aria-label={`${s.persona}, variant ${s.variant.toUpperCase()}, open live inspector`}
      style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', color: C.text, overflow: 'hidden', minWidth: 0 }}
    >
      <div style={{ height: 130, background: '#000', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {last ? (
          <Screenshot runId={runId} sessionId={s.session_id} idx={last.idx} device={s.device} maxHeight={130} style={{ border: 'none', borderRadius: 0, width: '100%' }} />
        ) : (
          <span className="mono" style={{ color: C.muted, fontSize: 11 }}>waiting for a browser</span>
        )}
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.persona}</div>
            <div style={{ color: C.muted2, fontSize: 12, marginTop: 2 }}>
              variant {s.variant.toUpperCase()} · {s.device} · {s.savviness} savviness
            </div>
          </div>
          <SessionTag s={s} />
        </div>
        <PatienceBar left={s.actions_left ?? 0} total={s.patience || 1} />
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: C.muted2 }}>
          <span>{used}/{s.patience} actions</span>
          <span>
            {observations.length} obs
            {worst > 0 && <span style={{ color: worst >= 4 ? C.red : worst >= 3 ? C.yellow : C.muted2 }}> · worst {worst}/5</span>}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mono" style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: C.muted2, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function PersonaCard({ p, custom }: { p: Persona; custom: boolean }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
        <Tag tone={custom ? 'blue' : 'muted'}>{custom ? 'custom' : 'built-in'}</Tag>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: C.muted2, lineHeight: 1.5 }}>{p.bio}</p>
      <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: C.muted2 }}>
        <span>{p.device}</span>
        <span>{p.tech_savviness} savviness</span>
        <span>{p.patience_steps} actions of patience</span>
        <span>{p.reading_style === 'skims' ? 'skims' : 'reads everything'}</span>
      </div>
      {(p.goals?.length ?? 0) > 0 && (
        <Field label="Goals"><ul style={{ margin: 0, paddingLeft: 16 }}>{p.goals.map((g) => <li key={g}>{g}</li>)}</ul></Field>
      )}
      {(p.frustrations?.length ?? 0) > 0 && (
        <Field label="Frustrations"><ul style={{ margin: 0, paddingLeft: 16 }}>{p.frustrations.map((f) => <li key={f}>{f}</li>)}</ul></Field>
      )}
    </div>
  );
}

function PersonaLibrary() {
  const [builtIn, setBuiltIn] = useState<Persona[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [custom] = useState<Persona[]>(() => loadCustomPersonas());
  useEffect(() => {
    let alive = true;
    getPersonas().then((p) => { if (alive) setBuiltIn(p); }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);
  return (
    <section aria-labelledby="persona-library" style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          <h2 id="persona-library" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Persona library</h2>
          <div style={{ color: C.muted2, fontSize: 13, marginTop: 4 }}>
            Every agent is one of these people. Patience is a hard budget of browser actions; when it runs out, they leave.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/populations/custom" className="btn-secondary" style={{ textDecoration: 'none' }}>Custom agents</Link>
          <Link to="/populations/new" className="btn-primary" style={{ textDecoration: 'none' }}>Create population</Link>
        </div>
      </div>
      {error && <div role="alert" style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>Could not load built-in personas: {error}</div>}
      {!builtIn && !error && <div style={{ color: C.muted2, fontSize: 13 }}>Loading personas…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
        {(builtIn ?? []).map((p) => <PersonaCard key={`b-${p.id}`} p={p} custom={false} />)}
        {custom.map((p) => <PersonaCard key={`c-${p.id}`} p={p} custom />)}
      </div>
    </section>
  );
}

export default function Populations() {
  const runId = useSelectedRunId();
  const { runs, error: runsError } = useRuns();
  const { run, error: runError } = useRun(runId);
  const [, setParams] = useSearchParams();
  const [variant, setVariant] = useState<string>('all');
  const [state, setState] = useState<StateFilter>('all');
  const [device, setDevice] = useState<DeviceFilter>('all');

  const sessions = useMemo(() => sessionList(run), [run]);
  const variants = useMemo(() => Array.from(new Set(sessions.map((s) => s.variant))).sort(), [sessions]);
  const variantOptions = useMemo(() => [{ value: 'all', label: 'All' }, ...variants.map((v) => ({ value: v, label: v.toUpperCase() }))], [variants]);
  const activeVariant = variant === 'all' || variants.includes(variant) ? variant : 'all';
  const shown = sessions.filter((s) => (activeVariant === 'all' || s.variant === activeVariant) && matchesState(s, state) && (device === 'all' || s.device === device));

  const counts = {
    running: sessions.filter((s) => s.status === 'running').length,
    completed: sessions.filter((s) => s.outcome === 'completed').length,
    failed: sessions.filter((s) => s.outcome != null && s.outcome !== 'completed').length,
  };

  const noRuns = runs != null && runs.length === 0 && !runId;
  const picker = runs && runs.length > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="run-picker" style={{ fontSize: 12, color: C.muted2 }}>Run</label>
      <select
        id="run-picker"
        className="input"
        value={runId ?? ''}
        onChange={(e) => setParams({ run: e.target.value })}
        style={{ width: 'auto', maxWidth: 'min(340px, 70vw)', padding: '6px 10px' }}
      >
        {runId && !runs.some((r) => r.run_id === runId) && <option value={runId}>{runId}</option>}
        {runs.map((r) => (
          <option key={r.run_id} value={r.run_id}>
            {fmtTime(r.created_at) || r.run_id} · {r.status} · {r.sessions ?? 0} agents
          </option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <Page title="Agents" subtitle="Every agent in the run, each in its own container with a real browser. Open one to watch it work." actions={picker} runBar={run ? <RunBar run={run} active="agents" /> : undefined}>
      {noRuns ? (
        <Empty title="No runs yet">
          Agents appear here once a test is running. <Link to="/tools" style={{ color: C.green }}>Start a run from Tools</Link> and come back to watch them.
        </Empty>
      ) : !run ? (
        <div className="card" style={{ padding: 32, color: C.muted2, fontSize: 13 }} aria-live="polite">
          {runError ? <span style={{ color: C.red }}>Could not load this run: {runError}</span> : runsError && !runId ? <span style={{ color: C.red }}>Could not load runs: {runsError}</span> : 'Loading agents…'}
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'center', marginBottom: 16 }}>
            <span className="mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{run.run_id}</span>
            <RunStatusTag status={run.status} />
            <div className="mono" aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: C.muted2, marginLeft: 'auto' }}>
              <span><b style={{ color: C.text }}>{sessions.length}</b> agents</span>
              <span><b style={{ color: C.yellow }}>{counts.running}</b> running</span>
              <span><b style={{ color: C.green }}>{counts.completed}</b> completed</span>
              <span><b style={{ color: C.red }}>{counts.failed}</b> failed or gave up</span>
            </div>
          </div>
          {run.error && <div role="alert" className="card" style={{ padding: 12, marginBottom: 16, color: C.red, fontSize: 13, borderColor: 'rgba(248,113,113,0.3)' }}>{run.error}</div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', marginBottom: 16 }}>
            <Segmented label="Variant" value={activeVariant} options={variantOptions} onChange={setVariant} />
            <Segmented label="State" value={state} options={STATE_OPTIONS} onChange={setState} />
            <Segmented label="Device" value={device} options={DEVICE_OPTIONS} onChange={setDevice} />
          </div>

          <SectionLabel>{shown.length === sessions.length ? `${sessions.length} agents` : `${shown.length} of ${sessions.length} agents`}</SectionLabel>
          {sessions.length === 0 ? (
            <Empty title="Containers are starting">Agents show up here as soon as their browsers are ready.</Empty>
          ) : shown.length === 0 ? (
            <Empty title="No agents match these filters">
              <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => { setVariant('all'); setState('all'); setDevice('all'); }}>Clear filters</button>
            </Empty>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              {shown.map((s) => <AgentTile key={s.session_id} runId={run.run_id} s={s} />)}
            </div>
          )}
        </>
      )}
      <PersonaLibrary />
    </Page>
  );
}
