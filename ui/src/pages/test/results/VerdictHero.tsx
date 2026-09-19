// The answer first: who won, how sure the evaluator is, and why.
import type { RunState } from '../../../lib/api';
import { variantName, isSingleSite } from '../../../lib/derive';
import { C, Tag } from '../../../lib/ui';
import { variantsOf, winnerOf } from './shared';

const CONFIDENCE_TONE = { high: 'green', medium: 'yellow', low: 'red' } as const;
const CONFIDENCE_HELP = {
  high: 'The numbers and the evidence point the same way.',
  medium: 'The evidence leans one way, with gaps.',
  low: 'Treat this as a lead to check, not a result.',
} as const;

export default function VerdictHero({ run }: { run: RunState }) {
  const verdict = run.verdict;
  if (!verdict) return null;
  const winner = winnerOf(run);
  const variants = variantsOf(run);
  const agents = Object.keys(run.sessions).length;
  const others = variants.filter((v) => v !== winner);
  const single = isSingleSite(run); // one website: an assessment, not a contest
  const done = Object.values(run.sessions).filter((s) => s.outcome === 'completed').length;
  return (
    <section aria-labelledby="pp-verdict" className="card" style={{
      padding: 'clamp(20px, 4vw, 32px)', minWidth: 0,
      borderColor: winner ? 'rgba(74,222,128,0.3)' : C.border2,
      background: winner ? 'linear-gradient(180deg, rgba(74,222,128,0.07), rgba(74,222,128,0.015) 60%), #111318' : C.surface,
    }}>
      <div className="mono" style={{ color: winner ? C.green : C.muted2, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {single ? 'Assessment' : 'Verdict'} · {agents} {agents === 1 ? 'agent' : 'agents'}{single ? '' : ` · ${variants.length} variants`}
      </div>
      <h2 id="pp-verdict" style={{ margin: '8px 0 0', fontSize: single ? 'clamp(24px, 4.5vw, 38px)' : 'clamp(32px, 7vw, 56px)', lineHeight: single ? 1.15 : 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: winner ? C.green : C.text }}>
        {single ? (verdict.headline || 'What the panel thought') : winner ? `Variant ${winner.toUpperCase()} wins` : 'No clear winner'}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center', marginTop: 12, fontSize: 13, color: C.muted2 }}>
        {single
          ? <span>{variantName(variants[0] ?? 'a', run.config)} · {done} of {agents} reached the goal</span>
          : winner
          ? <span>{variantName(winner, run.config)}{others.length > 0 && <span style={{ color: C.muted }}> beat {others.map((v) => variantName(v, run.config)).join(' and ')}</span>}</span>
          : <span>The evaluator compared {variants.map((v) => variantName(v, run.config)).join(' and ')} and did not find a difference it would stand behind.</span>}
        <span title={CONFIDENCE_HELP[verdict.confidence]}><Tag tone={winner ? CONFIDENCE_TONE[verdict.confidence] ?? 'muted' : 'muted'}>{verdict.confidence} confidence</Tag></span>
      </div>
      {verdict.rationale && <p style={{ margin: '18px 0 0', fontSize: 15, lineHeight: 1.65, color: C.text, maxWidth: 860 }}>{verdict.rationale}</p>}
      {verdict.caveats.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Caveats from the evaluator</div>
          <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', fontSize: 12, lineHeight: 1.6, color: C.muted2 }}>
            {verdict.caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
