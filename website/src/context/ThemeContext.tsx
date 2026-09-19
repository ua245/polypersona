import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

export interface Colors {
  bg: string;
  surface: string;
  border: string;
  borderSubtle: string;
  text: string;
  text2: string;
  text3: string;
  text4: string;
  text5: string;
  accent: string;
  accentDim: string;
  accentText: string;
  inputBg: string;
  hoverBg: string;
  pillBg: string;
}

const DARK: Colors = {
  bg:          '#09090e',
  surface:     '#111318',
  border:      'rgba(255,255,255,0.09)',
  borderSubtle:'rgba(255,255,255,0.05)',
  text:        '#e8eaf0',
  text2:       '#9ca3af',
  text3:       '#6b7280',
  text4:       '#4b5563',
  text5:       '#374151',
  accent:      '#4ade80',
  accentDim:   '#22c55e',
  accentText:  '#071810',
  inputBg:     'rgba(9,9,14,0.7)',
  hoverBg:     'rgba(255,255,255,0.04)',
  pillBg:      'rgba(255,255,255,0.05)',
};

const LIGHT: Colors = {
  bg:          '#eef0f5',
  surface:     '#ffffff',
  border:      'rgba(0,0,0,0.07)',
  borderSubtle:'rgba(0,0,0,0.04)',
  text:        '#0d0f14',
  text2:       '#374151',
  text3:       '#6b7280',
  text4:       '#9ca3af',
  text5:       '#d1d5db',
  accent:      '#16a34a',
  accentDim:   '#15803d',
  accentText:  '#ffffff',
  inputBg:     'rgba(255,255,255,0.85)',
  hoverBg:     'rgba(0,0,0,0.03)',
  pillBg:      'rgba(0,0,0,0.05)',
};

interface ThemeCtx { theme: Theme; toggle: () => void; c: Colors; }

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {}, c: DARK });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('pp-theme') as Theme) ?? 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pp-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return <Ctx.Provider value={{ theme, toggle, c: theme === 'dark' ? DARK : LIGHT }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
