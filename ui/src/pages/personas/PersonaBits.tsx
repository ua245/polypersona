// Persona avatar, grid card and detail panel, shared by the grid and the generate preview.
import type { Persona } from '../../lib/api';
import { avatarColor, initials } from '../../lib/derive';
import { C, Tag } from '../../lib/ui';

export type Source = 'built-in' | 'custom';
export interface Entry { persona: Persona; source: Source }

/** "68, retired school librarian in Ohio. Orders gifts…" -> "Retired school librarian in Ohio". */
export function descriptor(p: Persona): string {
  const first = (p.bio ?? '').split(/(?<=[.!?])\s/)[0]?.replace(/[.!?]+$/, '').replace(/^\d{1,3}(\s*years?\s*old)?\s*[,;:–-]\s*/i, '').trim() ?? '';
  if (first.length >= 4 && first.length <= 80) return first[0]!.toUpperCase() + first.slice(1);
  return `${p.device === 'mobile' ? 'Mobile' : 'Desktop'} user, ${p.tech_savviness} tech savviness`;
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.34), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials(name)}
    </span>
  );
}

const READING: Record<Persona['reading_style'], string> = { skims: 'Skims: acts on headings and buttons, misses small print', reads_everything: 'Reads everything before acting' };
const SAVVY: Record<Persona['tech_savviness'], string> = { low: 'Low: unfamiliar patterns stop them', medium: 'Medium: comfortable with common patterns', high: 'High: notices sloppy or manipulative design' };

export function PersonaDetail({ entry, onClose, onRemove }: { entry: Entry; onClose?: () => void; onRemove?: () => void }) {
  const p = entry.persona;
  const details = Object.entries(p.details ?? {});
  const list = (label: string, items: string[] | undefined) => (items?.length ?? 0) > 0 && (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', fontSize: 13, lineHeight: 1.6, color: C.muted2 }}>{items!.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
  const fact = (label: string, value: string) => (
    <div><dt style={{ fontSize: 11, color: C.muted }}>{label}</dt><dd style={{ margin: '2px 0 0', fontSize: 13, color: C.text, lineHeight: 1.5 }}>{value}</dd></div>
  );
  return (
    <div style={{ padding: 20, borderRadius: 8, background: C.surface2, border: `1px solid ${C.border2}`, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Avatar name={p.name} size={44} />
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{p.name}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' }}>
            <Tag tone={entry.source === 'custom' ? 'blue' : 'muted'}>{entry.source}</Tag>
            <span className="mono" style={{ fontSize: 11, color: C.muted, overflowWrap: 'anywhere' }}>{p.id}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onRemove && <button type="button" className="btn-secondary" onClick={onRemove} style={{ fontSize: 12, padding: '5px 10px', color: C.red }} aria-label={`Remove ${p.name}`}>Remove</button>}
          {onClose && <button type="button" className="btn-ghost" onClick={onClose} style={{ fontSize: 12, padding: '5px 10px' }}>Close</button>}
        </div>
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: C.text, maxWidth: 820 }}>{p.bio}</p>
      <div style={{ display: 'grid', gap: '16px 24px', marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
        {list('Goals', p.goals)}
        {list('Frustrations', p.frustrations)}
        <dl style={{ margin: 0, display: 'grid', gap: 10, alignContent: 'start' }}>
          {fact('Device', p.device === 'mobile' ? 'Mobile: a phone-sized browser' : 'Desktop browser')}
          {fact('Tech savviness', SAVVY[p.tech_savviness] ?? p.tech_savviness)}
          {fact('Patience', `${p.patience_steps} actions: gives up after ~${p.patience_steps} clicks, scrolls and keystrokes`)}
          {fact('Reading style', READING[p.reading_style] ?? p.reading_style)}
          {p.viewport && fact('Screen', p.viewport)}
          {p.source && fact('Source', p.source)}
        </dl>
        {details.length > 0 && (
          <dl style={{ margin: 0, display: 'grid', gap: 10, alignContent: 'start' }}>
            {details.map(([k, v]) => <div key={k}><dt style={{ fontSize: 11, color: C.muted }}>{k.replace(/_/g, ' ')}</dt><dd style={{ margin: '2px 0 0', fontSize: 13, color: C.text, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{String(v)}</dd></div>)}
          </dl>
        )}
      </div>
    </div>
  );
}

/** A persona as a read-only card, used to preview generated or imported personas before and after saving. */
export function PreviewCard({ persona: p, onRemove }: { persona: Persona; onRemove?: () => void }) {
  return (
    <li className="card" style={{ padding: 16, minWidth: 0, listStyle: 'none' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Avatar name={p.name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>{p.source ?? descriptor(p)}</div>
        </div>
        {onRemove && <button type="button" className="btn-ghost" onClick={onRemove} aria-label={`Remove ${p.name} from the preview`} style={{ fontSize: 12, padding: '4px 8px' }}>Remove</button>}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: C.muted2 }}>{p.bio}</p>
      <div className="mono" style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
        {p.device}{p.viewport ? ` ${p.viewport}` : ''} · {p.tech_savviness} savviness · gives up after ~{p.patience_steps} actions · {p.reading_style === 'reads_everything' ? 'reads everything' : 'skims'}
      </div>
    </li>
  );
}
