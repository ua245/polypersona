// Follow-up questions to the evaluator about one finished test. Adapted from the old insights page.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { askRun } from '../../../lib/api';
import { C, useTokenGate } from '../../../lib/ui';

const EXAMPLES = [
  'Why did the mobile persona fail?',
  'What is the single cheapest fix?',
  'Which issues affect low-savviness users most?',
];

/** **bold** inside one line, as React nodes. No HTML is ever injected. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>);
}

/** Line breaks, blank-line paragraphs, "-"/"*"/"1." list lines and "#" headings. */
export function AnswerText({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted2, overflowWrap: 'anywhere' }}>
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        const heading = /^#{1,4}\s+(.*)$/.exec(t);
        if (heading) return <div key={i} style={{ color: C.text, fontWeight: 600, marginTop: 4 }}>{inline(heading[1])}</div>;
        const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(t);
        if (bullet) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 4 }}>
              <span className="mono" style={{ color: C.muted, flexShrink: 0 }}>{/^\d/.test(bullet[1]) ? bullet[1] : '•'}</span>
              <span>{inline(bullet[2])}</span>
            </div>
          );
        }
        return <div key={i}>{inline(t)}</div>;
      })}
    </div>
  );
}

interface Exchange { question: string; answer: string }

export default function Ask({ runId, finished }: { runId: string; finished: boolean }) {
  const { guard, handleAuthError, dialog } = useTokenGate();
  const fieldId = useId();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);

  useEffect(() => { setHistory([]); setError(''); setQuestion(''); }, [runId]);
  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || busy || !finished) return;
    guard(async () => {
      setBusy(true); setError('');
      try {
        const { answer } = await askRun(runId, text);
        setHistory((h) => [{ question: text, answer }, ...h]);
        setQuestion('');
      } catch (e) {
        if (!handleAuthError(e, () => ask(text))) setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    });
  };

  const disabled = busy || !finished;
  return (
    <div className="card" style={{ padding: 16 }}>
      {dialog}
      <form onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 500 }}>Question about this test</label>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: C.muted }}>
          {finished
            ? 'The evaluator answers from this test’s sessions, metrics and verdict. You need to be signed in, and an answer usually takes 10 to 40 seconds.'
            : 'Available once the test has finished: the evaluator needs every session and the computed metrics before it can answer.'}
        </p>
        <textarea
          id={fieldId}
          className="input"
          rows={3}
          value={question}
          disabled={disabled}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(question); } }}
          placeholder="Ask why something happened, or what to change first"
          style={{ resize: 'vertical', minHeight: 72 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="btn-secondary" disabled={disabled} onClick={() => { setQuestion(ex); ask(ex); }} style={{ fontSize: 12, padding: '5px 10px', textAlign: 'left' }}>
              {ex}
            </button>
          ))}
          <button type="submit" className="btn-primary" disabled={disabled || !question.trim()} style={{ marginLeft: 'auto' }}>
            {busy ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {busy && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 13, color: C.muted2 }}>
            <span className="dot-yellow" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />
            The evaluator is reading the sessions. <span className="mono" style={{ color: C.muted }}>{seconds}s</span>
          </div>
        )}
        {error && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 14 }}>Could not get an answer: {error}</div>}
        {history.map((h, i) => (
          <div key={history.length - i} style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{h.question}</div>
            <AnswerText text={h.answer} />
          </div>
        ))}
      </div>
    </div>
  );
}
