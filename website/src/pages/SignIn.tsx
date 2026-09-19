import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { c } = useTheme();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate('/tests');
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 48px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: c.text, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
            Sign in to PolyPersona
          </h1>
          <p style={{ color: c.text3, fontSize: 13, margin: 0 }}>
            AI agent panels on real websites
          </p>
        </div>

        <div className="card-glass" style={{ padding: '26px 28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: c.text2, display: 'block', marginBottom: 6, fontWeight: 500 }}>Username</label>
              <input
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="polypersona"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.text2, display: 'block', marginBottom: 6, fontWeight: 500 }}>Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ fontSize: 14, padding: '10px', marginTop: 4, width: '100%' }}
            >
              Sign in →
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: c.text4, marginTop: 18 }}>
          No account?{' '}
          <span style={{ color: c.accent, cursor: 'pointer', opacity: 0.8 }}>Request access</span>
        </p>
      </div>
    </div>
  );
}
