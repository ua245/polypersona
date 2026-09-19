import { NavLink, Outlet, useLocation } from 'react-router';
import { useState } from 'react';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#09090e' }}>
      <Nav isLanding={isLanding} />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}

function Nav({ isLanding }: { isLanding: boolean }) {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      height: 48,
      borderBottom: '1px solid #1e2230',
      background: '#09090e',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      gap: 0,
    }}>
      {/* Logo */}
      <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 32 }}>
        <LogoIcon />
        <span style={{ color: '#e8eaf0', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>PolyPersona</span>
      </NavLink>

      {/* Nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <NavItem to="/workspace" label="Workspace" />
        <NavItem to="/populations" label="Populations" />
        <NavItem to="/tools" label="Tools" />
        <NavItem to="/insights" label="Insights" />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isLanding ? (
          <NavLink to="/workspace" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>Sign in</button>
          </NavLink>
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#09090e', cursor: 'pointer'
          }}>A</div>
        )}
      </div>
    </nav>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        color: isActive ? '#e8eaf0' : '#6b7280',
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: 6,
        background: isActive ? '#111318' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
      })}
    >
      {label}
    </NavLink>
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
