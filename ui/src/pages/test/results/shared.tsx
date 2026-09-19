// Small pieces every Results section shares, so the tab reads as one page.
import type { CSSProperties, ReactNode } from 'react';
import type { Issue, ObservationKind, RunState, SessionState } from '../../../lib/api';
import { sessionList } from '../../../lib/api';
import { C } from '../../../lib/ui';

/** Variant ids in the order the test was configured, then any that only appear in the data. */
export function variantsOf(run: RunState): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string | undefined | null) => { if (v && !seen.has(v)) { seen.add(v); out.push(v); } };
  // config.variants only describes demo shop tests; a test of your own site has the variants it actually ran.
  if (!run.config?.url_a) (run.config?.variants ?? []).forEach(add);
  (run.metrics ?? []).forEach((m) => add(m.variant_id));
  sessionList(run).map((s) => s.variant).sort().forEach(add);
  return out;
}

export const sessionsOf = (run: RunState, variant: string): SessionState[] => sessionList(run).filter((s) => s.variant === variant);

/** The winning variant id, or null when the evaluator named no clear winner. */
export function winnerOf(run: RunState): string | null {
  const w = run.verdict?.winner?.trim().toLowerCase() ?? '';
  const bare = w.replace(/^variant\s+/, '');
  return variantsOf(run).find((v) => v.toLowerCase() === bare) ?? null;
}

export const NEGATIVE_KINDS: ReadonlySet<ObservationKind> = new Set<ObservationKind>(['bug', 'friction', 'confusion']);
export const kindColor = (kind: ObservationKind): string => (kind === 'bug' ? C.red : kind === 'delight' ? C.green : kind === 'opinion' ? C.blue : C.yellow);
export const issueKey = (issue: Issue, index: number) => `${issue.variant_id}-${index}`;
export const issueDomId = (index: number) => `pp-issue-${index}`;

/** "1m 23s", "49s". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return 'n/a';
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/** Sentences, without breaking on decimals such as "5.0" or on abbreviations inside brackets. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter(Boolean);
}

export function Panel({ title, hint, children, style, id }: { title?: string; hint?: ReactNode; children: ReactNode; style?: CSSProperties; id?: string }) {
  return (
    <section id={id} className="card" style={{ padding: 20, minWidth: 0, ...style }}>
      {title && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
          {hint && <span style={{ fontSize: 11, color: C.muted }}>{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A numbered page section: mono eyebrow, heading, one line of help. */
export function Section({ eyebrow, title, help, children, id }: { eyebrow: string; title: string; help?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-label={title} style={{ marginTop: 40, minWidth: 0 }}>
      <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{eyebrow}</div>
      <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {help && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted2, maxWidth: 760, lineHeight: 1.55 }}>{help}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

export function Bar({ value, color, label }: { value: number; color: string; label?: string }) {
  const pctWidth = Math.max(0, Math.min(100, value * 100));
  return (
    <div role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ height: 3, background: C.border2, borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ height: '100%', width: `${pctWidth}%`, minWidth: value > 0 ? 3 : 0, background: color, borderRadius: 2 }} />
    </div>
  );
}
