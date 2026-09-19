// Everything the UI derives from raw run data lives here, so every screen agrees on what
// "blocked", "stage" or "sentiment" means.
import type { Observation, RunConfig, RunState, RunSummary, SessionState } from './api';

// ---------- paths ----------
export const testPath = (runId: string, tab?: 'live' | 'results') => `/tests/${encodeURIComponent(runId)}${tab === 'results' ? '?tab=results' : ''}`;
export const agentPath = (runId: string, sessionId: string, step?: number) =>
  `/tests/${encodeURIComponent(runId)}/agents/${encodeURIComponent(sessionId)}${step != null ? `#step-${step}` : ''}`;

// ---------- naming ----------
const VARIANT_BLURB: Record<string, string> = { a: 'clean checkout', b: 'dark patterns', c: 'redesign' };
export function targetLabel(config?: RunConfig | null): string {
  if (!config) return 'Test';
  if (config.url_a && config.url_b) {
    const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
    return `${host(config.url_a)} vs ${host(config.url_b)}`;
  }
  const v = config.variants ?? ['a', 'b'];
  return `Coffee shop checkout: ${v.map((x) => VARIANT_BLURB[x] ?? x.toUpperCase()).join(' vs ')}`;
}
export const testName = (r: { config?: RunConfig | null; name?: string | null }): string => r.name || r.config?.name || targetLabel(r.config);
export const variantName = (id: string, config?: RunConfig | null): string =>
  `Variant ${id.toUpperCase()}${config?.url_a ? '' : VARIANT_BLURB[id] ? ` · ${VARIANT_BLURB[id]}` : ''}`;

// ---------- people ----------
const AVATAR_COLORS = ['#0e7490', '#6d28d9', '#b91c1c', '#a16207', '#15803d', '#1d4ed8', '#be185d', '#c2410c'];
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
export const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length]!;

// ---------- stage: where in the journey an agent is, read from the page URL ----------
/** "…/b/#/checkout" -> "Checkout"; "…/products/42?x=1" -> "Products"; the landing page -> "Browse". */
export function stageOf(url: string | undefined): string {
  if (!url) return 'Starting';
  let tail = '';
  try {
    const u = new URL(url);
    const hash = u.hash.replace(/^#\/?/, '');
    const parts = (hash || u.pathname).split('/').filter((p) => p && !/^\d+$/.test(p) && !/^[a-z]$/i.test(p));
    tail = hash ? parts[0] ?? '' : parts[parts.length - 1] ?? '';
  } catch { return 'Browse'; }
  tail = tail.replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').trim();
  if (!tail || tail === 'index') return 'Browse';
  return tail[0]!.toUpperCase() + tail.slice(1);
}
export const currentStage = (s: SessionState): string => (s.steps.length ? stageOf(s.steps[s.steps.length - 1]!.url) : s.status === 'queued' ? 'Starting' : 'Browse');

/** Stages in the order agents first reached them, with how many agents of this variant got there. */
export function funnel(sessions: SessionState[]): { stage: string; reached: number; total: number }[] {
  const order: string[] = [];
  const reachedBy = new Map<string, Set<string>>();
  for (const s of sessions) for (const step of s.steps) {
    const st = stageOf(step.url);
    if (!reachedBy.has(st)) { reachedBy.set(st, new Set()); order.push(st); }
    reachedBy.get(st)!.add(s.session_id);
  }
  return order.map((stage) => ({ stage, reached: reachedBy.get(stage)!.size, total: sessions.length }));
}

// ---------- agent state, in the words the monitor uses ----------
export type AgentState = 'starting' | 'active' | 'hesitating' | 'done' | 'blocked';
export function agentState(s: SessionState): AgentState {
  if (s.outcome === 'completed') return 'done';
  if (s.outcome) return 'blocked'; // gave up, ran out of patience, or crashed
  if (s.status === 'queued' || s.steps.length === 0) return 'starting';
  const last = s.steps[s.steps.length - 1]!;
  const lowPatience = s.actions_left / s.patience < 0.25;
  return !last.changed || lowPatience ? 'hesitating' : 'active';
}
export const STATE_LABEL: Record<AgentState, string> = { starting: 'Starting', active: 'Active', hesitating: 'Hesitating', done: 'Done', blocked: 'Blocked' };
export const STATE_TONE: Record<AgentState, 'muted' | 'green' | 'yellow' | 'blue' | 'red'> = { starting: 'muted', active: 'green', hesitating: 'yellow', done: 'blue', blocked: 'red' };

// ---------- sentiment: 0-1 ----------
const NEGATIVE = new Set<Observation['kind']>(['bug', 'friction', 'confusion']);
/** After the exit survey: (ease + trust) / 10. Before it: delights against severity-weighted problems. */
export function sessionSentiment(s: SessionState): number | null {
  if (s.exit_survey) return (s.exit_survey.ease + s.exit_survey.trust) / 10;
  if (!s.observations.length) return null;
  const pos = s.observations.filter((o) => o.kind === 'delight').length;
  const neg = s.observations.filter((o) => NEGATIVE.has(o.kind)).reduce((n, o) => n + o.severity / 3, 0);
  return pos + neg === 0 ? null : pos / (pos + neg);
}
export function sentimentOf(sessions: SessionState[]): number | null {
  const values = sessions.map(sessionSentiment).filter((v): v is number => v != null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
export const SENTIMENT_HELP = 'Sentiment: after an agent answers its exit survey, (ease + trust) out of 10. Before that, delights weighed against problems by severity.';
export const pct = (v: number | null | undefined) => (v == null ? 'n/a' : `${Math.round(v * 100)}%`);
export const sentimentTone = (v: number | null): 'green' | 'yellow' | 'red' | 'muted' => (v == null ? 'muted' : v >= 0.6 ? 'green' : v >= 0.4 ? 'yellow' : 'red');

// ---------- run-level counts ----------
export function runCounts(run: RunState | null) {
  const sessions = run ? Object.values(run.sessions) : [];
  const by = (st: AgentState) => sessions.filter((s) => agentState(s) === st).length;
  return { total: sessions.length, starting: by('starting'), active: by('active'), hesitating: by('hesitating'), done: by('done'), blocked: by('blocked'), finished: sessions.filter((s) => s.status === 'finished').length };
}
export const summarySentiment = (r: RunSummary & { sentiment?: number | null }) => r.sentiment ?? null;
