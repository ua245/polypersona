import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { getUser, isSignedIn, signOut } from '../lib/api';
import { ACCENT_LIST, useTheme } from '../lib/theme';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isPublic = isLanding || location.pathname === '/login';
  // The app is for invited accounts: everything past the landing page needs a sign-in.
  if (!isPublic && !isSignedIn()) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--pp-bg)' }}>
      <Nav isLanding={isLanding} />
      <main style={{ flex: 1 }}><Outlet /></main>
    </div>
  );
}

function Nav({ isLanding }: { isLanding: boolean }) {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', padding: '0 clamp(12px, 3vw, 24px)', height: 48,
      borderBottom: '1px solid var(--pp-border)', background: 'color-mix(in srgb, var(--pp-bg) 82%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 'clamp(8px, 3vw, 32px)', flexShrink: 0 }}>
        <LogoIcon />
        <span style={{ color: 'var(--pp-text)', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>PolyPersona</span>
      </NavLink>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <NavItem to="/workspace" label="Tests" also="/tests" />
        <NavItem to="/new" label="New test" />
        <NavItem to="/personas" label="Personas" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThemeMenu />
        {isSignedIn() ? <UserMenu /> : (
          <NavLink to="/login" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>Sign in</button>
          </NavLink>
        )}
      </div>
    </nav>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  const user = getUser() || 'owner';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <div title={`Signed in as ${user}`} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--pp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--pp-on-accent)' }}>{user[0].toUpperCase()}</div>
      <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { signOut(); navigate('/'); }}>Sign out</button>
    </div>
  );
}

function NavItem({ to, label, also }: { to: string; label: string; also?: string }) {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(`${to}/`) || (also != null && pathname.startsWith(also));
  return (
    <NavLink to={to} aria-current={active ? 'page' : undefined} style={{
      color: active ? 'var(--pp-text)' : 'var(--pp-muted)', textDecoration: 'none',
      fontSize: 13, fontWeight: 500, padding: '6px 12px', borderRadius: 6, whiteSpace: 'nowrap',
      background: active ? 'var(--pp-surface)' : 'transparent',
      transition: 'color 0.15s, background 0.15s',
    }}>{label}</NavLink>
  );
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="7" height="7" rx="1.5" fill="var(--pp-accent)" />
      <rect x="10" y="1" width="7" height="7" rx="1.5" fill="var(--pp-accent)" opacity="0.5" />
      <rect x="1" y="10" width="7" height="7" rx="1.5" fill="var(--pp-accent)" opacity="0.5" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" fill="var(--pp-accent)" opacity="0.3" />
    </svg>
  );
}

/** Light or dark, plus an accent colour. Saved in this browser. */
function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className="btn-ghost" aria-label="Theme" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
        <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', background: 'conic-gradient(var(--pp-accent) 0 50%, var(--pp-text) 50% 100%)', boxShadow: '0 0 0 2px var(--pp-border2)' }} />
        <span style={{ fontSize: 12 }}>Theme</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Theme" className="pp-theme-pop">
          <div className="mono pp-theme-label">MODE</div>
          <div className="pp-seg">
            {(['dark', 'light'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={theme.mode === m} onClick={() => setTheme({ mode: m })}>
                {m === 'dark' ? '☾ Dark' : '☀ Light'}
              </button>
            ))}
          </div>
          <div className="mono pp-theme-label" style={{ marginTop: 14 }}>ACCENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {ACCENT_LIST.map((a) => (
              <button key={a.id} type="button" title={a.label} aria-label={a.label} aria-pressed={theme.accent === a.id} onClick={() => setTheme({ accent: a.id })}
                className="pp-swatch" style={{ background: theme.mode === 'dark' ? a.swatch : a.swatchLight }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--pp-muted)', marginTop: 10 }}>{ACCENT_LIST.find((a) => a.id === theme.accent)?.label} · {theme.mode}</div>
        </div>
      )}
      <style>{`
.pp-theme-pop { position: absolute; right: 0; top: calc(100% + 8px); width: 230px; padding: 14px; border-radius: 14px; z-index: 200;
  background: var(--pp-glass); border: 1px solid var(--pp-border2); box-shadow: 0 20px 50px var(--pp-shadow); backdrop-filter: blur(12px); }
.pp-theme-label { font-size: 10px; letter-spacing: 0.12em; color: var(--pp-muted); margin-bottom: 8px; }
.pp-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border-radius: 9px; background: var(--pp-surface2); border: 1px solid var(--pp-border); }
.pp-seg button { font: 500 12px 'Inter', sans-serif; padding: 6px; border-radius: 7px; border: 0; cursor: pointer; background: transparent; color: var(--pp-muted2); }
.pp-seg button[aria-pressed="true"] { background: var(--pp-surface); color: var(--pp-text); box-shadow: 0 1px 3px var(--pp-shadow); }
.pp-swatch { width: 100%; aspect-ratio: 1; border-radius: 50%; border: 2px solid var(--pp-surface); cursor: pointer; box-shadow: 0 0 0 1px var(--pp-border2); transition: transform .15s; }
.pp-swatch:hover { transform: scale(1.1); }
.pp-swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--pp-text); }
`}</style>
    </div>
  );
}
