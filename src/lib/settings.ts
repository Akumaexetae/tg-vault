const STORAGE_KEY = 'tg-vault-connection';

export interface Connection {
  url: string;
  key: string;
}

/**
 * Where the vault lives. Deliberately NOT compiled into the app: the key grants
 * full read/write to the database, so it stays on each machine rather than
 * inside a binary we distribute. Entered once per install.
 */
export function loadConnection(): Connection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Connection;
    return parsed.url && parsed.key ? parsed : null;
  } catch {
    return null;
  }
}

export function saveConnection(connection: Connection): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export function clearConnection(): void {
  localStorage.removeItem(STORAGE_KEY);
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
