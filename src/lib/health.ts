import type { Entry } from './types';

export type HealthIssue = 'weak' | 'reused' | 'old';

export interface HealthReport {
  weak: Entry[];
  reused: Entry[];
  old: Entry[];
  total: number;
}

const COMMON = new Set([
  'password', 'password1', '123456', '12345678', '123456789', 'qwerty',
  'azerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'onlyfans',
]);

/** Weak = shorter than 10 chars, a common password, or a single character class. */
export function isWeak(password: string): boolean {
  if (password.length < 10) return true;
  if (COMMON.has(password.toLowerCase())) return true;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  return classes < 2;
}

const DAY_MS = 86_400_000;

/** Not touched in over `maxDays` days (default 180). */
export function isOld(entry: Entry, now = Date.now(), maxDays = 180): boolean {
  const updated = new Date(entry.updated_at).getTime();
  if (Number.isNaN(updated)) return false;
  return now - updated > maxDays * DAY_MS;
}

export function healthReport(entries: Entry[], now = Date.now()): HealthReport {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.password) counts.set(e.password, (counts.get(e.password) ?? 0) + 1);
  }
  return {
    weak: entries.filter((e) => e.password && isWeak(e.password)),
    reused: entries.filter((e) => (counts.get(e.password) ?? 0) > 1),
    old: entries.filter((e) => isOld(e, now)),
    total: entries.length,
  };
}
