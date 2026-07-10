import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Architecture de thème extensible : 'light' et 'dark' sont pleinement
 * pris en charge pour le fond, les cartes et le texte ; 'custom' est un
 * troisième thème de démonstration ("Coucher de soleil") qui prouve que
 * l'ajout d'un thème supplémentaire ne nécessite qu'un bloc de variables
 * CSS (voir styles.css) — aucun composant n'a besoin d'être modifié.
 */
export type Theme = 'light' | 'dark' | 'custom';

const STORAGE_KEY = 'compatilo-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'custom') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>.');
  return ctx;
}
