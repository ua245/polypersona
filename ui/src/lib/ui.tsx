// Shared building blocks. Pages compose these so every screen reads as one product.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError, fmtTime, getToken, sessionList, shotUrl, signIn, signOut, type RunState, type ObservationKind, type Outcome, type RunStatus, type SessionState, type Step } from './api';

export const C = {
  bg: '#09090e', surface: '#111318', surface2: '#181b22', border: '#1e2230', border2: '#252a38',
  green: '#4ade80', yellow: '#facc15', red: '#f87171', blue: '#60a5fa', text: '#e8eaf0', muted: '#6b7280', muted2: '#9ca3af',
};

export function Page({ title, subtitle, actions, runBar, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; runBar?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '28px 24px 64px' }}>
      {runBar}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{title}</h1>
          {subtitle && <div style={{ color: C.muted2, fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      {children && <div style={{ color: C.muted2, fontSize: 13, marginTop: 6 }}>{children}</div>}
    </div>
  );
}

const tagClass = (tone: 'green' | 'yellow' | 'red' | 'blue' | 'muted') => `tag-green ${tone === 'green' ? '' : `tag-${tone}`}`;
export function Tag({ tone = 'muted', children, pulse }: { tone?: 'green' | 'yellow' | 'red' | 'blue' | 'muted'; children: ReactNode; pulse?: boolean }) {
  return <span className={tagClass(tone)} style={pulse ? { animation: 'pp-pulse 1.4s ease-in-out infinite' } : undefined}>{children}</span>;
}

export function RunStatusTag({ status }: { status: RunStatus }) {
  const tone = status === 'finished' ? 'green' : status === 'failed' ? 'red' : 'yellow';
  return <Tag tone={tone} pulse={tone === 'yellow'}>{status}</Tag>;
}

const OUTCOME_LABEL: Record<Outcome, string> = { completed: 'completed', gave_up: 'gave up', out_of_steps: 'ran out of patience', error: 'error' };
export function SessionTag({ s }: { s: Pick<SessionState, 'status' | 'outcome'> }) {
  if (s.outcome) return <Tag tone={s.outcome === 'completed' ? 'green' : 'red'}>{OUTCOME_LABEL[s.outcome]}</Tag>;
  return s.status === 'running' ? <Tag tone="yellow" pulse>running</Tag> : <Tag>queued</Tag>;
}

export const KIND_TONE: Record<ObservationKind, 'red' | 'yellow' | 'green' | 'blue'> = { bug: 'red', friction: 'yellow', confusion: 'yellow', delight: 'green', opinion: 'blue' };
export function KindTag({ kind, severity }: { kind: ObservationKind; severity?: number }) {
  return <Tag tone={KIND_TONE[kind]}>{kind}{severity != null ? ` · ${severity}` : ''}</Tag>;
}

/**
 * The three places a run lives, in the order you use them. Shown on every run page so the way forward
 * (and back) is always one click, and the run you are looking at never changes underneath you.
 */
export function RunBar({ run, active }: { run: RunState; active: 'watch' | 'agents' | 'results' }) {
  const sessions = sessionList(run);
  const done = sessions.filter((s) => s.status === 'finished').length;
  const ready = run.status === 'finished' && run.verdict != null;
  const q = `?run=${run.run_id}`;
  const tabs: { key: typeof active; n: number; label: string; to: string; hint: string }[] = [
    { key: 'watch', n: 1, label: 'Watch live', to: `/tools${q}`, hint: run.status === 'finished' ? 'replay the monitor' : `${done}/${sessions.length} agents finished` },
    { key: 'agents', n: 2, label: 'Inspect agents', to: `/populations${q}`, hint: `${sessions.length} agents, step by step` },
    { key: 'results', n: 3, label: 'Read the verdict', to: `/insights${q}`, hint: ready ? `winner: ${run.verdict!.winner}` : run.status === 'evaluating' ? 'evaluator is judging…' : 'ready when all agents finish' },
  ];
  return (
    <div className="card" style={{ padding: 10, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px', minWidth: 0 }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="mono" style={{ fontSize: 12, color: C.muted2 }}>{run.run_id}</span><RunStatusTag status={run.status} /></span>
        <span style={{ fontSize: 11, color: C.muted }}>{fmtTime(run.created_at)}</span>
      </div>
      <nav aria-label="Run steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 6, flex: '1 1 520px' }}>
        {tabs.map((t) => {
          const on = t.key === active;
          const nudge = t.key === 'results' && ready && !on; // the verdict is in: point at it
          return (
            <Link key={t.key} to={t.to} aria-current={on ? 'page' : undefined} style={{
              textDecoration: 'none', color: C.text, padding: '8px 12px', borderRadius: 6, minWidth: 0,
              background: on ? C.surface2 : 'transparent', border: `1px solid ${on ? C.green : nudge ? 'rgba(74,222,128,0.45)' : C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span className="mono" style={{ fontSize: 11, color: on ? C.green : C.muted2 }}>{t.n}</span>{t.label}
                {nudge && <span className="dot-green" style={{ animation: 'pp-pulse 1.4s ease-in-out infinite' }} />}
              </div>
              <div style={{ fontSize: 11, color: nudge ? C.green : C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.hint}</div>
            </Link>
          );
        })}
      </nav>
      <Link to="/tools" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}>New test</Link>
    </div>
  );
}

/** Patience left, as a bar that turns red when nearly spent. */
export function PatienceBar({ left, total }: { left: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div className="progress-bar" title={`${left} of ${total} actions of patience left`}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: pct < 25 ? C.red : pct < 50 ? C.yellow : C.green }} />
    </div>
  );
}

/** "click — clicked button: Continue", "type_text “43215”" */
export function stepLabel(step: Step): string {
  const verb = { open: 'open', click: 'click', type_text: 'type', scroll: `scroll ${step.args.direction ?? ''}`, press_key: `press ${step.args.key ?? ''}`, go_back: 'back' }[step.action] ?? step.action;
  const text = step.args.text ? ` “${step.args.text}”` : '';
  return `${verb.trim()}${text}${step.note ? ` — ${step.note}` : ''}`;
}

/**
 * The screen after step `idx`. If `nextStep` has x/y (the click made while looking at this screen),
 * a marker shows where the agent clicked. Coordinates are on a 0-1000 grid.
 */
export function Screenshot({ runId, sessionId, idx, nextStep, device, maxHeight, style }: {
  runId: string; sessionId: string; idx: number; nextStep?: Step; device?: 'desktop' | 'mobile'; maxHeight?: number; style?: CSSProperties;
}) {
  const hasDot = nextStep?.args.x != null && nextStep?.args.y != null;
  return (
    <div style={{ background: '#000', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', display: 'flex', justifyContent: 'center', ...style }}>
      <div style={{ position: 'relative', lineHeight: 0, maxWidth: device === 'mobile' ? 300 : '100%' }}>
        <img src={shotUrl(runId, sessionId, idx)} alt={`Screen after step ${idx}`} style={{ display: 'block', maxWidth: '100%', maxHeight: maxHeight ?? undefined }} />
        {hasDot && (
          <span style={{
            position: 'absolute', left: `${nextStep!.args.x! / 10}%`, top: `${nextStep!.args.y! / 10}%`, width: 18, height: 18, margin: '-9px 0 0 -9px',
            borderRadius: '50%', background: 'rgba(74,222,128,0.35)', border: `2px solid ${C.green}`, boxShadow: '0 0 0 4px rgba(74,222,128,0.15)', pointerEvents: 'none',
          }} />
        )}
      </div>
    </div>
  );
}

/**
 * Wraps an action that needs a signed-in user (anything that spends money). If nobody is signed in, or the
 * session was rejected, a sign-in dialog opens and the action runs after a successful sign-in.
 */
export function useTokenGate() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const guard = (action: () => void) => {
    if (getToken()) action();
    else { setPending(() => action); setOpen(true); }
  };
  /** Call from a catch block: reopens the dialog if the stored session was rejected. */
  const handleAuthError = (e: unknown, retry: () => void): boolean => {
    if (e instanceof ApiError && e.status === 401) { signOut(); setError('Your session expired. Sign in again.'); setPending(() => retry); setOpen(true); return true; }
    return false;
  };
  const submit = async () => {
    setBusy(true); setError('');
    try { await signIn(username, password); setOpen(false); setPassword(''); pending?.(); setPending(null); }
    catch (e) { setError(e instanceof ApiError && e.status === 401 ? 'Wrong username or password.' : 'Could not reach the server. Try again.'); }
    finally { setBusy(false); }
  };

  const dialog = open ? (
    <div role="dialog" aria-modal="true" aria-labelledby="pp-signin-title" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <form className="card" style={{ padding: 24, width: 400, maxWidth: '100%' }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div id="pp-signin-title" style={{ fontSize: 16, fontWeight: 600 }}>Sign in to continue</div>
        <p style={{ color: C.muted2, fontSize: 13, margin: '6px 0 16px' }}>Starting a test uses Gemini and Modal credit, so it needs an account. Viewing runs does not.</p>
        <SignInFields username={username} password={password} onUsername={setUsername} onPassword={setPassword} />
        {error && <div role="alert" style={{ color: C.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setPending(null); }}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !username.trim() || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  ) : null;

  return { guard, handleAuthError, dialog };
}

export function SignInFields({ username, password, onUsername, onPassword }: { username: string; password: string; onUsername: (v: string) => void; onPassword: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label htmlFor="pp-username" style={{ fontSize: 12, color: C.muted2, display: 'block', marginBottom: 4 }}>Username</label>
        <input id="pp-username" className="input" autoComplete="username" autoCapitalize="none" autoFocus value={username} onChange={(e) => onUsername(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pp-password" style={{ fontSize: 12, color: C.muted2, display: 'block', marginBottom: 4 }}>Password</label>
        <input id="pp-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => onPassword(e.target.value)} />
      </div>
    </div>
  );
}
