// The evaluator's issues, most severe first, each tied back to the exact steps it cites.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Issue, ObservationKind, RunState } from '../../../lib/api';
import { agentPath } from '../../../lib/derive';
import { C, Empty, KindTag, Screenshot, Tag } from '../../../lib/ui';
import { issueDomId, issueKey } from './shared';

interface Evidence { raw: string; sessionId: string; step: number | null }

/** "sofia-b-0#14" -> session "sofia-b-0", step 14. Anything malformed keeps its text and loses the step. */
function parseEvidence(raw: string): Evidence {
  const at = raw.lastIndexOf('#');
  if (at < 0) return { raw, sessionId: raw, step: null };
  const n = Number(raw.slice(at + 1));
  return { raw, sessionId: raw.slice(0, at), step: Number.isInteger(n) && n >= 0 ? n : null };
}

export function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      background: active ? 'rgba(var(--pp-accent-rgb),0.1)' : 'transparent', color: active ? C.green : C.muted2,
      border: `1px solid ${active ? 'rgba(var(--pp-accent-rgb),0.3)' : C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}

function EvidenceChips({ run, evidence }: { run: RunState; evidence: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  const items = evidence.map(parseEvidence);
  const shown = items.find((e) => e.raw === active && e.step != null && run.sessions[e.sessionId]);
  const shownSession = shown ? run.sessions[shown.sessionId] : undefined;
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setActive(null)}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.muted }}>Evidence</span>
        {items.map((e, i) => {
          const session = run.sessions[e.sessionId];
          const style = {
            fontSize: 11, padding: '2px 8px', borderRadius: 4, textDecoration: 'none',
            border: `1px solid ${active === e.raw ? C.green : C.border2}`, color: session ? C.text : C.muted, background: C.surface2,
          };
          if (!session) return <span key={`${e.raw}-${i}`} className="mono" style={style} title="This session is not in the test">{e.raw}</span>;
          return (
            <Link
              key={`${e.raw}-${i}`}
              className="mono"
              to={agentPath(run.run_id, e.sessionId, e.step ?? undefined)}
              aria-label={`${session.persona}, variant ${session.variant.toUpperCase()}${e.step != null ? `, step ${e.step}` : ''}: open this moment`}
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
      {shown && shown.step != null && shownSession && (
        <div role="presentation" style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 20, width: 'min(320px, 100%)', padding: 8, background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, boxShadow: '0 12px 32px var(--pp-shadow)', pointerEvents: 'none' }}>
          <Screenshot runId={run.run_id} sessionId={shown.sessionId} idx={shown.step} device={shownSession.device} maxHeight={220} />
          <div style={{ fontSize: 11, color: C.muted2, marginTop: 6 }}>
            {shownSession.persona}, variant {shownSession.variant.toUpperCase()}, screen after step {shown.step}. Click to open the agent at this step.
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({ run, issue, index, highlighted }: { run: RunState; issue: Issue; index: number; highlighted: boolean }) {
  const keep = issue.kind === 'delight';
  return (
    <li id={issueDomId(index)} tabIndex={-1} className="card" style={{ padding: 16, listStyle: 'none', scrollMarginTop: 80, outline: 'none', borderColor: highlighted ? C.green : undefined, boxShadow: highlighted ? '0 0 0 3px rgba(var(--pp-accent-rgb),0.15)' : 'none', transition: 'border-color 0.3s, box-shadow 0.3s' }}>
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

/** `focus` comes from the themes and alerts above: it clears the filters, scrolls to the issue and marks it. */
export default function Issues({ run, issues, focus }: { run: RunState; issues: Issue[]; focus: { index: number; nonce: number } | null }) {
  const [variant, setVariant] = useState<string | null>(null);
  const [kind, setKind] = useState<ObservationKind | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const variants = useMemo(() => [...new Set(issues.map((i) => i.variant_id))].sort(), [issues]);
  const kinds = useMemo(() => [...new Set(issues.map((i) => i.kind))], [issues]);
  const sorted = useMemo(() => issues.map((issue, index) => ({ issue, index })).sort((a, b) => b.issue.severity - a.issue.severity), [issues]);
  const visible = sorted.filter(({ issue }) => (variant == null || issue.variant_id === variant) && (kind == null || issue.kind === kind));

  useEffect(() => {
    if (!focus) return;
    setVariant(null); setKind(null); setHighlight(focus.index);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(issueDomId(focus.index));
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
    const timer = setTimeout(() => setHighlight(null), 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [focus]);

  if (issues.length === 0) return <Empty title="No issues reported">The evaluator did not raise any issues for this test.</Empty>;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginBottom: 12 }}>
        {variants.length > 1 && (
          <div role="group" aria-label="Filter by variant" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <FilterButton active={variant == null} onClick={() => setVariant(null)}>All variants</FilterButton>
            {variants.map((v) => <FilterButton key={v} active={variant === v} onClick={() => setVariant(variant === v ? null : v)}>Variant {v.toUpperCase()}</FilterButton>)}
          </div>
        )}
        <div role="group" aria-label="Filter by kind" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <FilterButton active={kind == null} onClick={() => setKind(null)}>All kinds</FilterButton>
          {kinds.map((k) => <FilterButton key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>{k}</FilterButton>)}
        </div>
      </div>
      <div aria-live="polite" style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
        {visible.length} of {issues.length} shown, most severe first. Severity runs 1 to 5. Hover an evidence chip to see the screen; click it to open the agent at that step.
      </div>
      {visible.length === 0 ? (
        <Empty title="Nothing matches these filters" />
      ) : (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {visible.map(({ issue, index }) => <IssueCard key={issueKey(issue, index)} run={run} issue={issue} index={index} highlighted={highlight === index} />)}
        </ul>
      )}
    </div>
  );
}
