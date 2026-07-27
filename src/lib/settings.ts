import type { User } from './types';

export interface Connection {
  url: string;
  key: string;
}

/**
 * Machine settings live in a file in the main process, not localStorage.
 *
 * localStorage is scoped to the renderer's origin, which in dev is
 * http://localhost:<port> — and Vite picks a new port whenever the old one is
 * busy. A new origin meant an empty store and a fresh "connect this PC"
 * prompt every few launches. A file in userData is immune to that, and it's
 * the right home for machine configuration anyway.
 *
 * Values are mirrored in memory so reads stay synchronous during first render.
 */
const LEGACY_CONNECTION_KEY = 'tg-vault-connection';
const LEGACY_USER_KEY = 'tg-vault-user';

let cache: Record<string, unknown> = {
  ...(globalThis.window?.vaultBridge?.initialSettings ?? {}),
};

function persist(patch: Record<string, unknown>): void {
  cache = { ...cache, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) delete cache[key];
  }
  window.vaultBridge?.saveSettings(patch).catch(() => {});
}

/**
 * Moves anything left in localStorage by an earlier version into the file, so
 * an existing install doesn't get asked to reconnect after updating.
 */
export function migrateLegacySettings(): void {
  try {
    if (!cache.connection) {
      const raw = localStorage.getItem(LEGACY_CONNECTION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Connection;
        if (parsed?.url && parsed?.key) persist({ connection: parsed });
      }
    }
    if (!cache.user) {
      const user = localStorage.getItem(LEGACY_USER_KEY);
      if (user === 'Tyler' || user === 'Gabriel') persist({ user });
    }
  } catch {
    /* nothing to migrate */
  }
}

export function loadConnection(): Connection | null {
  const stored = cache.connection as Connection | undefined;
  return stored?.url && stored?.key ? stored : null;
}

export function saveConnection(connection: Connection): void {
  persist({ connection });
}

export function clearConnection(): void {
  persist({ connection: null });
}

export function loadUser(): User | null {
  const user = cache.user;
  return user === 'Tyler' || user === 'Gabriel' ? user : null;
}

export function saveUser(user: User): void {
  persist({ user });
}

/** Small UI preferences — layout choices, open nav groups. */
export function loadPreference<T>(key: string, fallback: T): T {
  return (cache[`pref:${key}`] as T) ?? fallback;
}

export function savePreference(key: string, value: unknown): void {
  persist({ [`pref:${key}`]: value });
}

/** Trims stray whitespace and the `/rest/v1/` suffix people paste by mistake. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/rest\/v1$/i, '');
}

/** Returns an error message, or null when the pair looks usable. */
export function validateConnection(url: string, key: string): string | null {
  const cleaned = normalizeUrl(url);
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleaned)) {
    return 'That URL should look like https://yourproject.supabase.co';
  }
  if (key.trim().length < 20) {
    return 'That key looks too short — copy the full anon/publishable key.';
  }
  return null;
}
