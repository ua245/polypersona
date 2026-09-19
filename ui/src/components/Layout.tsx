import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { getUser, isSignedIn, signOut } from '../lib/api';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isPublic = isLanding || location.pathname === '/login';
  // The app is for invited accounts: everything past the landing page needs a sign-in.
  if (!isPublic && !isSignedIn()) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#09090e' }}>
      <Nav isLanding={isLanding} />
      <main style={{ flex: 1 }}><Outlet /></main>
    </div>
  );
}

function Nav({ isLanding }: { isLanding: boolean }) {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', padding: '0 clamp(12px, 3vw, 24px)', height: 48,
      borderBottom: '1px solid #1e2230', background: '#09090e',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 'clamp(8px, 3vw, 32px)', flexShrink: 0 }}>
        <LogoIcon />
        <span style={{ color: '#e8eaf0', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>PolyPersona</span>
      </NavLink>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <NavItem to="/workspace" label="Home" />
        <NavItem to="/tools" label="New test" end />
        <NavItem to="/populations" label="Agents" keepRun />
        <NavItem to="/insights" label="Insights" keepRun />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      <div title={`Signed in as ${user}`} style={{ width: 28, height: 28, borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#09090e' }}>{user[0].toUpperCase()}</div>
      <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { signOut(); navigate('/'); }}>Sign out</button>
    </div>
  );
}

function NavItem({ to, label, keepRun, end }: { to: string; label: string; keepRun?: boolean; end?: boolean }) {
  // Agents and Insights stay on the run you are looking at; New test always opens a blank setup.
  const run = new URLSearchParams(useLocation().search).get('run');
  const target = keepRun && run ? `${to}?run=${encodeURIComponent(run)}` : to;
  const watching = to === '/tools' && run != null; // /tools?run=… is the live monitor, not a new test
  return (
    <NavLink to={target} end={end} style={({ isActive: matched }) => { const isActive = matched && !watching; return ({
      color: isActive ? '#e8eaf0' : '#6b7280', textDecoration: 'none',
      fontSize: 13, fontWeight: 500, padding: '6px 12px', borderRadius: 6, whiteSpace: 'nowrap',
      background: isActive ? '#111318' : 'transparent',
      transition: 'color 0.15s, background 0.15s',
    }); }}>{label}</NavLink>
  );
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="7" height="7" rx="1.5" fill="#4ade80" />
      <rect x="10" y="1" width="7" height="7" rx="1.5" fill="#4ade80" opacity="0.5" />
      <rect x="1" y="10" width="7" height="7" rx="1.5" fill="#4ade80" opacity="0.5" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" fill="#4ade80" opacity="0.3" />
    </svg>
  );
}
