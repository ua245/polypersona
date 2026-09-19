// The evaluator's issues, sorted by severity, each tied back to the exact steps it cites.
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Issue, ObservationKind, RunState } from '../../lib/api';
import { C, Empty, KindTag, Screenshot, Tag } from '../../lib/ui';

interface Evidence { raw: string; sessionId: string; step: number | null }

/** "sofia-b-0#14" -> session "sofia-b-0", step 14. Anything malformed keeps its text and loses the step. */
function parseEvidence(raw: string): Evidence {
  const at = raw.lastIndexOf('#');
  if (at < 0) return { raw, sessionId: raw, step: null };
  const n = Number(raw.slice(at + 1));
  return { raw, sessionId: raw.slice(0, at), step: Number.isInteger(n) && n >= 0 ? n : null };
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        background: active ? 'rgba(74,222,128,0.1)' : 'transparent', color: active ? C.green : C.muted2,
        border: `1px solid ${active ? 'rgba(74,222,128,0.3)' : C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function EvidenceChips({ run, evidence }: { run: RunState; evidence: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  const items = evidence.map(parseEvidence);
  const shown = items.find((e) => e.raw === active && e.step != null && run.sessions[e.sessionId]);
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setActive(null)}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.muted }}>Evidence</span>
        {items.map((e) => {
          const known = run.sessions[e.sessionId] != null;
          const style = {
            fontSize: 11, padding: '2px 8px', borderRadius: 4, textDecoration: 'none',
            border: `1px solid ${active === e.raw ? C.green : C.border2}`, color: known ? C.text : C.muted, background: C.surface2,
          };
          if (!known) return <span key={e.raw} className="mono" style={style} title="This session is not in the run">{e.raw}</span>;
          return (
            <Link
              key={e.raw}
              className="mono"
              to={`/populations/${encodeURIComponent(e.sessionId)}?run=${encodeURIComponent(run.run_id)}${e.step != null ? `#step-${e.step}` : ''}`}
              style={style}
              onMouseEnter={() => setActive(e.raw)}
              onFocus={() => setActive(e.raw)}
              onBlur={() => setActive(null)}
            >
              {e.raw}
            </Link>
          );
        })}
      </div>
      {shown && shown.step != null && (
        <div
          role="presentation"
          style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 20, width: 'min(320px, 100%)', padding: 8, background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
        >
          <Screenshot runId={run.run_id} sessionId={shown.sessionId} idx={shown.step} device={run.sessions[shown.sessionId].device} maxHeight={220} />
          <div style={{ fontSize: 11, color: C.muted2, marginTop: 6 }}>
            {run.sessions[shown.sessionId].persona}, variant {run.sessions[shown.sessionId].variant.toUpperCase()}, screen after step {shown.step}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({ run, issue }: { run: RunState; issue: Issue }) {
  const keep = issue.kind === 'delight';
  return (
    <li className="card" style={{ padding: 16, listStyle: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <KindTag kind={issue.kind} severity={issue.severity} />
        <Tag>variant {issue.variant_id.toUpperCase()}</Tag>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: '1 1 220px' }}>{issue.title}</h3>
      </div>
      {issue.recommendation && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: C.muted2, lineHeight: 1.55 }}>
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: keep ? C.green : C.yellow, marginRight: 8 }}>{keep ? 'Keep' : 'Fix'}</span>
          {issue.recommendation}
        </p>
      )}
      {issue.affected_personas.length > 0 && (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
          {keep ? 'Noticed by' : 'Affected'}: <span style={{ color: C.muted2 }}>{issue.affected_personas.join(', ')}</span>
        </div>
      )}
      {issue.evidence.length > 0 && <div style={{ marginTop: 10 }}><EvidenceChips run={run} evidence={issue.evidence} /></div>}
    </li>
  );
}

export default function Issues({ run, issues }: { run: RunState; issues: Issue[] }) {
  const [variant, setVariant] = useState<string | null>(null);
  const [kind, setKind] = useState<ObservationKind | null>(null);
  const variants = useMemo(() => [...new Set(issues.map((i) => i.variant_id))].sort(), [issues]);
  const kinds = useMemo(() => [...new Set(issues.map((i) => i.kind))], [issues]);
  const sorted = useMemo(() => [...issues].sort((a, b) => b.severity - a.severity), [issues]);
  const visible = sorted.filter((i) => (variant == null || i.variant_id === variant) && (kind == null || i.kind === kind));

  if (issues.length === 0) return <Empty title="No issues reported">The evaluator did not raise any issues for this run.</Empty>;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginBottom: 12 }}>
        <div role="group" aria-label="Filter by variant" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <FilterButton active={variant == null} onClick={() => setVariant(null)}>All variants</FilterButton>
          {variants.map((v) => <FilterButton key={v} active={variant === v} onClick={() => setVariant(variant === v ? null : v)}>Variant {v.toUpperCase()}</FilterButton>)}
        </div>
        <div role="group" aria-label="Filter by kind" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <FilterButton active={kind == null} onClick={() => setKind(null)}>All kinds</FilterButton>
          {kinds.map((k) => <FilterButton key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>{k}</FilterButton>)}
        </div>
      </div>
      <div aria-live="polite" style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
        {visible.length} of {issues.length} shown, most severe first. Severity runs 1 to 5.
      </div>
      {visible.length === 0 ? (
        <Empty title="Nothing matches these filters" />
      ) : (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {visible.map((issue, i) => <IssueCard key={`${issue.variant_id}-${issue.title}-${i}`} run={run} issue={issue} />)}
        </ul>
      )}
    </div>
  );
}
