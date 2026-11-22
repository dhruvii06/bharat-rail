import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { alternateTheme, resolveInitialTheme, THEME_STORAGE_KEY, type ColorTheme } from './themePreference';

interface ThemeContextValue {
  theme: ColorTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTheme(): ColorTheme {
  if (typeof window === 'undefined') return 'light';
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* storage unavailable */ }
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveInitialTheme(stored, prefersDark);
}

/** Theme is available on the login screen and all authenticated screens. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  const toggleTheme = () => setTheme(current => alternateTheme(current));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
