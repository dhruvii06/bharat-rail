/** Small pure helpers so theme selection can be tested without a DOM. */
export type ColorTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'bharat-rail.theme';

export function parseStoredTheme(value: string | null): ColorTheme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveInitialTheme(saved: string | null, systemPrefersDark: boolean): ColorTheme {
  return parseStoredTheme(saved) ?? (systemPrefersDark ? 'dark' : 'light');
}

export function alternateTheme(theme: ColorTheme): ColorTheme {
  return theme === 'light' ? 'dark' : 'light';
}
