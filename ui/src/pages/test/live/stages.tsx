// Journey stages as the Live tab and the agent page read them: ordered, per agent, with a small icon.
import type { SessionState } from '../../../lib/api';
import { stageOf } from '../../../lib/derive';

export interface StageVisit { stage: string; firstIdx: number; actions: number; noChange: number }

/** The stages one agent went through, in the order it first reached them. */
export function stageVisits(s: SessionState): StageVisit[] {
  const out: StageVisit[] = [];
  const at = new Map<string, StageVisit>();
  for (const step of s.steps) {
    const stage = stageOf(step.url);
    let v = at.get(stage);
    if (!v) { v = { stage, firstIdx: step.idx, actions: 0, noChange: 0 }; at.set(stage, v); out.push(v); }
    v.actions += 1;
    if (!step.changed) v.noChange += 1;
  }
  return out;
}

/**
 * Every stage seen in the run, in journey order. A stage only one variant has (say "Payment" on B) is
 * slotted in after the stage that agent came from, so "Confirmed" stays last instead of landing mid-table.
 */
export function orderedStages(sessions: SessionState[]): string[] {
  const order: string[] = [];
  for (const s of sessions) {
    let prev = -1;
    for (const { stage } of stageVisits(s)) {
      const found = order.indexOf(stage);
      if (found >= 0) { prev = Math.max(prev, found); continue; }
      order.splice(prev + 1, 0, stage);
      prev += 1;
    }
  }
  return order;
}

type IconName = 'search' | 'cart' | 'user' | 'pin' | 'card' | 'list' | 'check' | 'dot';
function iconFor(stage: string): IconName {
  const s = stage.toLowerCase();
  if (/confirm|done|success|thank|complete/.test(s)) return 'check';
  if (/payment|\bpay\b|card|billing/.test(s)) return 'card';
  if (/review|summary/.test(s)) return 'list';
  if (/checkout|address|delivery|shipping/.test(s)) return 'pin';
  if (/cart|bag|basket/.test(s)) return 'cart';
  if (/account|login|log in|sign|register/.test(s)) return 'user';
  if (/browse|search|product|shop|catalog|home/.test(s)) return 'search';
  return 'dot';
}

export function StageIcon({ stage, color, size = 18 }: { stage: string; color: string; size?: number }) {
  const name = iconFor(stage);
  const p = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={{ flexShrink: 0, display: 'block' }}>
      {name === 'search' && <><circle cx="9" cy="9" r="5" {...p} /><path d="M13 13l4 4" {...p} /></>}
      {name === 'cart' && <><path d="M2.5 3.5h2.2l2 9h8.2l1.7-6.3H6" {...p} /><circle cx="8" cy="16" r="1.1" {...p} /><circle cx="14" cy="16" r="1.1" {...p} /></>}
      {name === 'user' && <><circle cx="10" cy="7" r="3.2" {...p} /><path d="M3.8 17c.7-3.2 3.2-4.8 6.2-4.8s5.5 1.6 6.2 4.8" {...p} /></>}
      {name === 'pin' && <><path d="M10 17.500s-5.5-4.7-5.5-9a5.5 5.5 0 0111 0c0 4.3-5.5 9-5.5 9z" {...p} /><circle cx="10" cy="8.5" r="1.9" {...p} /></>}
      {name === 'card' && <><rect x="2.5" y="4.5" width="15" height="11" rx="1.8" {...p} /><path d="M2.5 8.500h15M5.5 12.500h3" {...p} /></>}
      {name === 'list' && <><rect x="4" y="3" width="12" height="14.5" rx="1.8" {...p} /><path d="M7 7.500h6M7 10.500h6M7 13.500h3.5" {...p} /></>}
      {name === 'check' && <><circle cx="10" cy="10" r="7" {...p} /><path d="M6.8 10.200l2.2 2.2 4.2-4.6" {...p} /></>}
      {name === 'dot' && <circle cx="10" cy="10" r="3" fill={color} />}
    </svg>
  );
}
