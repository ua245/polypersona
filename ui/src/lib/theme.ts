// Themes: a light or dark mode plus an accent palette. Every colour in the app is a CSS variable
// (see C in ui.tsx and index.css), so switching a theme only rewrites the variables on <html>.
import { useEffect, useState } from 'react';

export type Mode = 'dark' | 'light';
export type Accent = 'emerald' | 'violet' | 'ocean' | 'fuchsia' | 'mono';

const MODES: Record<Mode, Record<string, string>> = {
  dark: {
    bg: '#09090e', surface: '#111318', surface2: '#181b22', border: '#1e2230', border2: '#252a38',
    text: '#e8eaf0', muted: '#6b7280', muted2: '#9ca3af',
    red: '#f87171', 'red-rgb': '248,113,113', yellow: '#facc15', 'yellow-rgb': '250,204,21', blue: '#60a5fa', 'blue-rgb': '96,165,250',
    'muted-rgb': '107,114,128', delight: '#a3e635', 'stripe-1': '#0d0f15', 'stripe-2': '#0b0d12', shadow: 'rgba(0,0,0,0.55)', glass: 'rgba(17,19,24,0.94)',
    'dot-grid': 'rgba(255,255,255,0.07)', heat: '1',
  },
  light: {
    bg: '#f6f7fb', surface: '#ffffff', surface2: '#f0f2f7', border: '#e3e6ee', border2: '#d3d8e3',
    text: '#11142a', muted: '#8b91a5', muted2: '#565d73',
    red: '#dc2626', 'red-rgb': '220,38,38', yellow: '#b45309', 'yellow-rgb': '180,83,9', blue: '#2563eb', 'blue-rgb': '37,99,235',
    'muted-rgb': '107,114,128', delight: '#65a30d', 'stripe-1': '#f7f8fc', 'stripe-2': '#fbfcff', shadow: 'rgba(17,20,42,0.14)', glass: 'rgba(255,255,255,0.96)',
    'dot-grid': 'rgba(17,20,42,0.08)', heat: '0.45',
  },
};

// accent, a stronger shade for hover, and the rgb triplet for tints — per mode.
const ACCENTS: Record<Accent, { label: string; dark: [string, string, string]; light: [string, string, string]; on: Record<Mode, string> }> = {
  emerald: { label: 'Emerald', dark: ['#4ade80', '#22c55e', '74,222,128'], light: ['#16a34a', '#15803d', '22,163,74'], on: { dark: '#09090e', light: '#ffffff' } },
  violet: { label: 'Violet', dark: ['#a78bfa', '#8b5cf6', '167,139,250'], light: ['#7c3aed', '#6d28d9', '124,58,237'], on: { dark: '#0c0a1a', light: '#ffffff' } },
  ocean: { label: 'Ocean', dark: ['#38bdf8', '#0ea5e9', '56,189,248'], light: ['#0284c7', '#0369a1', '2,132,199'], on: { dark: '#04121c', light: '#ffffff' } },
  fuchsia: { label: 'Fuchsia', dark: ['#f472b6', '#ec4899', '244,114,182'], light: ['#db2777', '#be185d', '219,39,119'], on: { dark: '#1a0710', light: '#ffffff' } },
  mono: { label: 'Mono', dark: ['#e8eaf0', '#ffffff', '232,234,240'], light: ['#11142a', '#000000', '17,20,42'], on: { dark: '#09090e', light: '#ffffff' } },
};
export const ACCENT_LIST = Object.entries(ACCENTS).map(([id, a]) => ({ id: id as Accent, label: a.label, swatch: a.dark[0], swatchLight: a.light[0] }));

const KEY = 'pp-theme';
interface Theme { mode: Mode; accent: Accent }

function read(): Theme {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Theme> | null;
    if (saved?.mode && saved.accent && saved.accent in ACCENTS) return saved as Theme;
  } catch { /* storage blocked or corrupt: fall back to defaults */ }
  const light = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return { mode: light ? 'light' : 'dark', accent: 'emerald' };
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(MODES[t.mode])) root.style.setProperty(`--pp-${k}`, v);
  const [accent, strong, rgb] = ACCENTS[t.accent][t.mode];
  root.style.setProperty('--pp-accent', accent);
  root.style.setProperty('--pp-accent-strong', strong);
  root.style.setProperty('--pp-accent-rgb', rgb);
  root.style.setProperty('--pp-on-accent', ACCENTS[t.accent].on[t.mode]);
  root.dataset.theme = t.mode;
  root.style.colorScheme = t.mode;
}

/** Apply the saved theme before React renders, so there is no flash of the wrong colours. */
export const initTheme = () => applyTheme(read());

const listeners = new Set<(t: Theme) => void>();
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);
  useEffect(() => { listeners.add(setThemeState); return () => { listeners.delete(setThemeState); }; }, []);
  const setTheme = (next: Partial<Theme>) => {
    const t = { ...read(), ...next };
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* not persisted; still applied */ }
    applyTheme(t);
    listeners.forEach((l) => l(t));
  };
  return { theme, setTheme };
}
