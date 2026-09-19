// Results: the story top-down. Who won, how sure, why, what to fix first, then the proof.
import { useState } from 'react';
import type { RunState } from '../../lib/api';
import { runCounts } from '../../lib/derive';
import { downloadMarkdown, downloadPdf } from '../../lib/report';
import { C } from '../../lib/ui';
import Ask from './results/Ask';
import Funnel from './results/Funnel';
import Issues from './results/Issues';
import KpiTiles from './results/KpiTiles';
import Metrics from './results/Metrics';
import { Section, winnerOf } from './results/shared';
import { KeyFinding, LeadingThemes, NotableAlerts } from './results/Themes';
import Voices from './results/Voices';
import Suggestions from './results/Suggestions';
import VerdictHero from './results/VerdictHero';

const STYLES = `
.pp-theme-row { display: flex; align-items: center; gap: 10px; padding: 8px; margin: 0 -8px; width: calc(100% + 16px); background: transparent; border: none; border-radius: 6px; cursor: pointer; font-family: inherit; text-align: left; color: inherit; }
.pp-theme-row:hover { background: var(--pp-surface2); }
.pp-clamp-5, .pp-clamp-2 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.pp-clamp-5 { -webkit-line-clamp: 5; }
.pp-clamp-2 { -webkit-line-clamp: 2; }
.pp-export { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
.pp-export-btn { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; padding: 6px 12px; }
`;

function Waiting({ run, onOpenLive }: { run: RunState; onOpenLive: () => void }) {
  const counts = runCounts(run);
  const failed = run.status === 'failed';
  const evaluating = run.status === 'evaluating';
  const noVerdict = run.status === 'finished';
  const title = failed ? 'This test failed, so there is no verdict'
    : evaluating ? 'The evaluator is judging now'
    : noVerdict ? 'This test finished without a verdict'
    : 'Results appear when every agent finishes';
  const body = failed ? `${run.error ? `${run.error} ` : ''}You can still replay what each agent did before it stopped.`
    : evaluating ? 'Every agent has finished. The evaluator is reading their steps, observations and exit surveys, and will name a winner or say there is no clear one. This usually takes under a minute.'
    : noVerdict ? 'The agents finished, but the evaluator did not return a verdict. The recorded sessions are still available.'
    : `${counts.finished} of ${counts.total} agents have finished. Once the last one answers its exit survey, the metrics are computed in code and the evaluator writes the verdict. This page updates by itself.`;
  return (
    <div>
      <div className="card" role="status" style={{ padding: 'clamp(20px, 4vw, 32px)', borderColor: failed ? 'rgba(var(--pp-red-rgb),0.35)' : C.border }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: failed ? C.red : C.muted2, display: 'flex', alignItems: 'center', gap: 8 }}>
          {!failed && !noVerdict && <span className="dot-yellow" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
          {failed ? 'Failed' : evaluating ? 'Judging' : noVerdict ? 'No verdict' : 'In progress'}
        </div>
        <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{title}</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: C.muted2, maxWidth: 680 }}>{body}</p>
        {!failed && !noVerdict && counts.total > 0 && (
          <div className="progress-bar" style={{ maxWidth: 320, marginTop: 16 }} role="progressbar" aria-label="Agents finished" aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={counts.finished}>
            <div className="progress-fill" style={{ width: `${(counts.finished / counts.total) * 100}%` }} />
          </div>
        )}
        <button type="button" className="btn-primary" onClick={onOpenLive} style={{ marginTop: 18 }}>{failed || noVerdict ? 'Replay the agents' : 'Watch the agents'}</button>
      </div>
      {run.metrics && run.metrics.length > 0 && (
        <Section eyebrow="Already known" title="Metrics so far" help="These are computed in code from the recorded sessions, so they are ready before the evaluator is.">
          <Metrics metrics={run.metrics} />
        </Section>
      )}
    </div>
  );
}

export default function ResultsTab({ run, onOpenLive }: { run: RunState; onOpenLive: () => void }) {
  const [focus, setFocus] = useState<{ index: number; nonce: number } | null>(null);
  const select = (index: number) => setFocus((f) => ({ index, nonce: (f?.nonce ?? 0) + 1 }));

  if (run.status !== 'finished' || !run.verdict) return <><style>{STYLES}</style><Waiting run={run} onOpenLive={onOpenLive} /></>;

  const verdict = run.verdict;
  return (
    <div style={{ minWidth: 0 }}>
      <style>{STYLES}</style>
      <ExportBar run={run} />
      <VerdictHero run={run} />
      <div style={{ marginTop: 12 }}><KpiTiles run={run} /></div>
      {verdict.suggestions && verdict.suggestions.length > 0 && (
        <Section eyebrow="What to change" title="Suggested improvements, in priority order" help="Judged against your objective and the task people were given. Each one links to the moments that prompted it.">
          <Suggestions run={run} suggestions={verdict.suggestions} />
        </Section>
      )}

      <div style={{ display: 'grid', gap: 12, marginTop: 12, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        <LeadingThemes issues={verdict.issues} onSelect={select} />
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <KeyFinding run={run} onSelect={select} />
          <NotableAlerts issues={verdict.issues} onSelect={select} />
        </div>
      </div>

      <Section eyebrow="Where people drop" title="Completion funnel, variant by variant" help="Each stage is a page the agents reached, in the order they first reached it. A short bar is where that variant lost people.">
        <Funnel run={run} />
      </Section>

      {run.metrics && run.metrics.length > 0 && (
        <Section eyebrow="Computed in code" title="Metrics" help="No model produced these numbers. They come straight from the recorded steps and exit surveys.">
          <Metrics metrics={run.metrics} winner={winnerOf(run)} />
        </Section>
      )}

      <Section eyebrow="What to fix, with proof" title="Issues and evidence" help="Every issue cites the exact agent and step where it happened.">
        <Issues run={run} issues={verdict.issues} focus={focus} />
      </Section>

      <Section eyebrow="In their words" title="What each persona said" help="From the exit survey each agent answers when it finishes or gives up.">
        <Voices run={run} />
      </Section>

      <Section eyebrow="Dig deeper" title="Ask the evaluator" help="Follow-up questions are answered from this test's sessions, metrics and verdict.">
        <Ask runId={run.run_id} finished />
      </Section>

      <div style={{ marginTop: 28, fontSize: 13, color: C.muted2 }}>
        Want to see it happen? <button type="button" onClick={onOpenLive} style={{ background: 'none', border: 'none', padding: 0, color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Replay every agent in the Live tab</button>
      </div>
    </div>
  );
}

/** Download the finished report: a print-ready PDF, or Markdown for docs and tickets. */
function ExportBar({ run }: { run: RunState }) {
  const [busy, setBusy] = useState(false);
  const icon = <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1.5v8M3.8 6.5 7 9.7l3.2-3.2M2 12.5h10" /></svg>;
  return (
    <div className="pp-export" role="group" aria-label="Export report">
      <span style={{ fontSize: 12, color: C.muted2 }}>Export report</span>
      <button type="button" className="btn-secondary pp-export-btn" disabled={busy} onClick={async () => { setBusy(true); try { await downloadPdf(run); } finally { setBusy(false); } }}>
        {icon}{busy ? 'Preparing PDF…' : 'Download PDF'}
      </button>
      <button type="button" className="btn-secondary pp-export-btn" onClick={() => downloadMarkdown(run)}>{icon}Download Markdown</button>
    </div>
  );
}
