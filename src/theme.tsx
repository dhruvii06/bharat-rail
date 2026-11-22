import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
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

function applyTheme(theme: ColorTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Theme is available on the login screen and all authenticated screens. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  /**
   * Switching cross-fades the whole page in one step. Browsers with the View Transitions API
   * snapshot the old and new page and blend them; others fade colours via a short-lived class.
   * Users who ask for reduced motion get an instant switch.
   */
  const toggleTheme = () => {
    const next = alternateTheme(theme);
    if (reducedMotion()) { setTheme(next); return; }
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => {
        applyTheme(next);                    // the new snapshot must already have the new colours
        flushSync(() => setTheme(next));
      });
      return;
    }
    const root = document.documentElement;
    root.classList.add('theme-changing');
    setTheme(next);
    window.setTimeout(() => root.classList.remove('theme-changing'), 400);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
