// "Who tests it": toggle cards, plus one detail panel that follows hover and focus so the grid never jumps.
import type { Persona } from '../../lib/api';
import { C } from '../../lib/ui';
import { Avatar, CheckCircle } from './bits';

export interface PickablePersona { key: string; persona: Persona; custom: boolean }

/** "68 · desktop · low savviness · patient reader" */
export function descriptor(p: Persona): string {
  const age = (p.bio ?? '').match(/^\s*(\d{2})\b/)?.[1];
  const reader = p.reading_style === 'reads_everything' ? 'patient reader' : 'skims';
  return [age, p.device, `${p.tech_savviness} savviness`, reader].filter(Boolean).join(' · ');
}

export default function PersonaPicker({ people, selected, onToggle, shown, onShow }: {
  people: PickablePersona[]; selected: Set<string>; onToggle: (key: string) => void; shown: Persona | null; onShow: (key: string) => void;
}) {

  return (
    <div>
      <div role="group" aria-label="Personas" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 10 }}>
        {people.map(({ key, persona: p, custom }) => {
          const on = selected.has(key);
          return (
            <button
              key={key} type="button" aria-pressed={on} aria-describedby="nt-persona-detail"
              onClick={() => onToggle(key)} onMouseEnter={() => onShow(key)} onFocus={() => onShow(key)}
              className="nt-pick" data-on={on}
            >
              <Avatar name={p.name} size={36} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {custom && <span className="mono" style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>CUSTOM</span>}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: C.muted2, marginTop: 3, lineHeight: 1.4 }}>{descriptor(p)}</span>
              </span>
              <CheckCircle on={on} size={18} />
            </button>
          );
        })}
      </div>

      {/* On narrow screens the detail sits under the grid; on wide ones NewTest shows it in the side column. */}
      <div id="nt-persona-detail" className="nt-detail-inline">{shown && <PersonaDetail p={shown} />}</div>
    </div>
  );
}

export function PersonaDetail({ p }: { p: Persona }) {
  return (
    <div style={{ padding: '14px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg }}>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
        <span style={{ fontWeight: 600 }}>{p.name}</span>
        <span style={{ color: C.muted2 }}> · gives up after {p.patience_steps} actions</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted2, lineHeight: 1.55 }}>{p.bio}</p>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <DetailList title="Wants to" items={p.goals} />
        <DetailList title="Loses patience with" items={p.frustrations} />
      </div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.muted2, lineHeight: 1.6 }}>
        {items.map((g) => <li key={g}>{g}</li>)}
      </ul>
    </div>
  );
}
