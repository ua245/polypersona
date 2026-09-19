// Client for the Polypersona API (FastAPI on Modal). All pages go through this file.
import { useEffect, useRef, useState } from 'react';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://shehrum--polypersona-web.modal.run';

// ---------- types (mirror polypersona/models.py and live.py) ----------
export type Device = 'desktop' | 'mobile';
export type Savviness = 'low' | 'medium' | 'high';
export type ObservationKind = 'bug' | 'friction' | 'confusion' | 'delight' | 'opinion';
export type Outcome = 'completed' | 'gave_up' | 'out_of_steps' | 'error';
export type RunStatus = 'starting' | 'running' | 'evaluating' | 'finished' | 'failed';

export interface Persona {
  id: string;
  name: string;
  bio: string;
  goals: string[];
  frustrations: string[];
  tech_savviness: Savviness;
  patience_steps: number;
  device: Device;
  reading_style: 'skims' | 'reads_everything';
}

export interface Step {
  idx: number; // 0 is the initial page load; screenshot idx shows the screen AFTER this step
  action: 'open' | 'click' | 'type_text' | 'scroll' | 'press_key' | 'go_back';
  args: { x?: number; y?: number; text?: string; direction?: string; key?: string; url?: string }; // x,y on a 0-1000 grid
  reasoning: string; // the persona's first-person reason
  changed: boolean; // false = nothing visibly changed (a dead click if action is click)
  note: string; // what the click landed on, e.g. "clicked button: Continue"
  url: string;
  ts: number; // unix seconds
}

export interface Observation { step_idx: number; kind: ObservationKind; severity: number; text: string }

export interface ExitSurvey {
  believes_completed: boolean;
  ease: number; // 1-5
  trust: number; // 1-5
  would_return: boolean;
  summary: string;
  biggest_problem: string | null;
}

export interface SessionState {
  session_id: string; // "<persona_id>-<variant>-<repeat>"
  persona: string; // display name
  persona_id: string;
  bio: string;
  device: Device;
  savviness: Savviness;
  reading_style: string;
  patience: number; // total action budget
  variant: string;
  repeat: number;
  goal: string;
  status: 'queued' | 'running' | 'finished';
  outcome: Outcome | null;
  steps: Step[];
  observations: Observation[];
  actions_left: number;
  exit_survey: ExitSurvey | null;
  has_video: boolean;
  duration_s: number | null;
  tokens: number | null;
  error: string | null;
}

export interface VariantMetrics {
  variant_id: string;
  sessions: number;
  completion_rate: number; // 0-1
  mean_steps: number;
  mean_duration_s: number;
  dead_clicks: number;
  backtracks: number;
  mean_ease: number | null;
  mean_trust: number | null;
  observations_by_kind: Partial<Record<ObservationKind, number>>;
  mean_negative_severity: number | null;
  errors: number;
  input_tokens: number;
  output_tokens: number;
}

export interface Issue {
  variant_id: string;
  title: string;
  kind: ObservationKind;
  severity: number;
  affected_personas: string[];
  evidence: string[]; // "<session_id>#<step_idx>"
  recommendation: string;
}

export interface Verdict {
  winner: string; // a variant id or "no clear winner"
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  issues: Issue[];
  per_persona_notes: string[];
  caveats: string[];
}

export interface RunConfig {
  persona_ids?: string[] | null; // built-in personas: "margaret" | "dev" | "sofia"
  custom_personas?: Persona[] | null; // takes precedence over persona_ids
  variants?: string[]; // demo shop: "a" clean, "b" dark patterns, "c" plausible redesign
  url_a?: string | null; // own site: set url_a, url_b and goal
  url_b?: string | null;
  goal?: string | null;
  success_url?: string | null;
  success_text?: string | null;
  success_selector?: string | null;
  repeats?: number; // 1-3
}

export interface RunState {
  run_id: string;
  created_at: number;
  status: RunStatus;
  config: RunConfig;
  sessions: Record<string, SessionState>;
  metrics: VariantMetrics[] | null; // set when evaluating/finished
  verdict: Verdict | null; // set when finished
  tokens: { evaluator_input?: number; evaluator_output?: number; total?: number } | null;
  error: string | null;
}

export interface RunSummary {
  run_id: string;
  status: RunStatus;
  created_at?: number;
  sessions?: number;
  winner?: string | null;
  confidence?: string | null;
  tokens?: number;
  config?: RunConfig;
}

// ---------- session: sign in with a username and password, the API returns a signed token ----------
const TOKEN_KEY = 'polypersona.token';
const USER_KEY = 'polypersona.user';
const read = (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const write = (k: string, v: string): void => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } };
export const getToken = (): string => read(TOKEN_KEY);
export const setToken = (t: string): void => write(TOKEN_KEY, t.trim());
export const getUser = (): string => read(USER_KEY);
export const signOut = (): void => { write(TOKEN_KEY, ''); write(USER_KEY, ''); };
export const isSignedIn = (): boolean => getToken() !== '';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init?.auth) headers.authorization = `Bearer ${getToken()}`;
  const res = await fetch(API_URL + path, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* not json */ }
    throw new ApiError(res.status, String(detail));
  }
  return res.json() as Promise<T>;
}

export const getPersonas = () => request<Persona[]>('/api/personas');
export const listRuns = () => request<RunSummary[]>('/api/runs');
export const getRun = (runId: string) => request<RunState>(`/api/runs/${runId}`);
export const checkToken = () => request<{ ok: boolean; user: string }>('/api/auth', { auth: true });
export async function signIn(username: string, password: string): Promise<string> {
  const res = await request<{ token: string; user: string }>('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  setToken(res.token); write(USER_KEY, res.user);
  return res.user;
}
export const startRun = (config: RunConfig) => request<{ run_id: string }>('/api/runs', { method: 'POST', body: JSON.stringify(config), auth: true });
export const askRun = (runId: string, question: string) => request<{ answer: string }>(`/api/runs/${runId}/ask`, { method: 'POST', body: JSON.stringify({ question }), auth: true });
export const generatePersonas = (audience: string, n: number) => request<Persona[]>('/api/personas/generate', { method: 'POST', body: JSON.stringify({ audience, n }), auth: true });

export const shotUrl = (runId: string, sessionId: string, idx: number) => `${API_URL}/api/runs/${runId}/sessions/${sessionId}/shots/${idx}.jpg`;
export const videoUrl = (runId: string, sessionId: string) => `${API_URL}/api/runs/${runId}/sessions/${sessionId}/video`;

// ---------- custom personas generated in the UI, kept in this browser ----------
const CUSTOM_KEY = 'polypersona.customPersonas';
export const loadCustomPersonas = (): Persona[] => { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]'); } catch { return []; } };
export const saveCustomPersonas = (p: Persona[]): void => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

// ---------- hooks ----------
const isLive = (s?: RunStatus) => s === 'starting' || s === 'running' || s === 'evaluating';

/** Polls a run every second while it is live, then stops. */
export function useRun(runId: string | null | undefined) {
  const [run, setRun] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRun(null); setError(null);
    if (!runId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await getRun(runId);
        if (stop) return;
        setRun(next); setError(null);
        if (!isLive(next.status)) return;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
      timer = setTimeout(tick, 1000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [runId]);
  return { run, error, live: isLive(run?.status) };
}

/** Run summaries, newest first. Polls every 5 s. */
export function useRuns() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const load = () => listRuns().then((r) => { if (alive.current) { setRuns(r); setError(null); } }).catch((e) => alive.current && setError(String(e.message ?? e)));
    load();
    const id = setInterval(load, 5000);
    return () => { alive.current = false; clearInterval(id); };
  }, []);
  return { runs, error };
}

/** The run to show: ?run=<id> if present, otherwise the newest run. */
export function useSelectedRunId(): string | null {
  const { runs } = useRuns();
  const fromUrl = new URLSearchParams(window.location.search).get('run');
  return fromUrl ?? runs?.[0]?.run_id ?? null;
}

export const sessionList = (run: RunState | null): SessionState[] =>
  run ? Object.values(run.sessions).sort((a, b) => a.persona_id.localeCompare(b.persona_id) || a.repeat - b.repeat || a.variant.localeCompare(b.variant)) : [];

export const fmtTokens = (n?: number | null) => (n == null ? '–' : n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n));
export const fmtTime = (unix?: number) => (unix ? new Date(unix * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
