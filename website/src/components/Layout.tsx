import { NavLink, Outlet, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isSignIn = location.pathname === '/signin';
  const isApp = !isLanding && !isSignIn;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--body-bg)', position: 'relative', transition: 'background 0.25s' }}>
      {!isLanding && <div className="page-depth" />}
      <Nav isLanding={isLanding} isApp={isApp} />
      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}><Outlet /></main>
    </div>
  );
}

function Nav({ isLanding, isApp }: { isLanding: boolean; isApp: boolean }) {
  const { theme, toggle, c } = useTheme();
  return (
    <nav className="nav-glass" style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 48, position: 'sticky', top: 0, zIndex: 100 }}>
      <NavLink to={isApp ? '/tests' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 28 }}>
        <LogoIcon />
        <span style={{ color: c.text, fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em' }}>PolyPersona</span>
      </NavLink>

      {isApp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <NavItem to="/tests" label="Tests" />
          <NavItem to="/tests/new" label="New test" />
          <NavItem to="/personas" label="Personas" />
        </div>
      )}

      {!isApp && <div style={{ flex: 1 }} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            width: 30, height: 30, borderRadius: 7, border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all 0.15s', backdropFilter: 'blur(8px)',
          }}
        >
          {theme === 'dark' ? <SunIcon color={c.text3} /> : <MoonIcon color={c.text3} />}
        </button>

        {isLanding ? (
          <>
            <NavLink to="/signin" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost" style={{ fontSize: 12 }}>Sign in</button>
            </NavLink>
            <NavLink to="/signin" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>Get started</button>
            </NavLink>
          </>
        ) : isApp ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NavLink to="/insights" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>Insights</button>
            </NavLink>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#071810', cursor: 'pointer',
              boxShadow: '0 0 10px rgba(74,222,128,0.3)',
            }}>P</div>
            <NavLink to="/" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>Sign out</button>
            </NavLink>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  const { c } = useTheme();
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        color: isActive ? c.text : c.text3,
        textDecoration: 'none', fontSize: 13,
        fontWeight: isActive ? 500 : 400,
        padding: '5px 11px', borderRadius: 6,
        background: isActive ? 'var(--btn-ghost-hover)' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
        letterSpacing: '-0.01em',
      })}
    >{label}</NavLink>
  );
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="7" height="7" rx="1.5" fill="#4ade80" />
      <rect x="10" y="1" width="7" height="7" rx="1.5" fill="#4ade80" opacity="0.55" />
      <rect x="1" y="10" width="7" height="7" rx="1.5" fill="#4ade80" opacity="0.55" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" fill="#4ade80" opacity="0.25" />
    </svg>
  );
}

function SunIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.5" stroke={color} strokeWidth="1.3"/>
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M11 8.5A5.5 5.5 0 0 1 4.5 2a5.5 5.5 0 1 0 6.5 6.5z" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
