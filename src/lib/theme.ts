import { loadPreference, savePreference } from './settings';

/**
 * Theme is a MACHINE preference, not vault data.
 *
 * It lives in settings.json alongside the connection, deliberately not in
 * Postgres: everything in the database syncs between the two founders within
 * seconds, so a theme stored there would mean Tyler switching to dark also
 * flipped Gabriel's Vault. Appearance is per-person, per-screen.
 */
export type Theme = 'light' | 'dark' | 'system';

/** What actually gets painted — 'system' resolves to one of these. */
export type ResolvedTheme = 'light' | 'dark';

const PREF_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function loadTheme(): Theme {
  const stored = loadPreference<Theme>(PREF_KEY, 'system');
  return isTheme(stored) ? stored : 'system';
}

export function saveTheme(theme: Theme): void {
  savePreference(PREF_KEY, theme);
}

/** Whether the OS is currently asking for dark. False where unsupported. */
export function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

/**
 * Sets the attribute the stylesheet keys off. The CSS defines light as the
 * default and overrides it under [data-theme='dark'], so an unset attribute
 * still renders correctly if this never runs.
 */
export function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

/**
 * Calls back when the OS theme changes, so 'system' follows it live rather
 * than only at launch. Returns an unsubscribe function; no-op where matchMedia
 * is missing.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  try {
    const query = window.matchMedia(DARK_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}
