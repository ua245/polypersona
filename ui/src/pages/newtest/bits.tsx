// Small presentational pieces shared by the New test, Tests and Landing pages.
import type { CSSProperties, ReactNode } from 'react';
import { C } from '../../lib/ui';
import { avatarColor, initials } from '../../lib/derive';

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="mono" style={{ color: C.muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', ...style }}>{children}</div>;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{
      flex: 'none', width: size, height: size, borderRadius: '50%', background: avatarColor(name), color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.36), fontWeight: 600, letterSpacing: '0.02em',
    }}>{initials(name)}</span>
  );
}

/** The circle from the checklist: hollow until the decision is valid, then a green tick. */
export function CheckCircle({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <span aria-hidden="true" style={{
      flex: 'none', width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1.5px solid ${on ? C.green : C.border2}`, background: on ? 'rgba(var(--pp-accent-rgb),0.12)' : 'transparent', transition: 'border-color 0.15s, background 0.15s',
    }}>
      {on && <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 10 10" fill="none"><path d="M2 5.2 4.2 7.4 8 3" stroke={C.green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, color: C.muted2, marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}
