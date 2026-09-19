import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, signIn } from '../lib/api';
import { C, SignInFields } from '../lib/ui';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next') || '/workspace';

  const submit = async () => {
    setBusy(true); setError('');
    try { await signIn(username, password); navigate(next.startsWith('/') ? next : '/workspace', { replace: true }); }
    catch (e) { setError(e instanceof ApiError && e.status === 401 ? 'Wrong username or password.' : 'Could not reach the server. Try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '72px 16px' }}>
      <form className="card" style={{ padding: 28, width: 400, maxWidth: '100%' }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>PolyPersona</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Sign in</h1>
        <p style={{ color: C.muted2, fontSize: 13, margin: '0 0 20px', lineHeight: 1.6 }}>Use the account you were given. It lets you start tests, watch the persona agents work, and question the evaluator.</p>
        <SignInFields username={username} password={password} onUsername={setUsername} onPassword={setPassword} />
        {error && <div role="alert" style={{ color: C.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 20, padding: '10px 16px' }} disabled={busy || !username.trim() || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
