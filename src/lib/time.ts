/** "just now", "5m ago", "2h ago", "3d ago", else "12 Jun 2026". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (Number.isNaN(then)) return '';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Mar 2026" from a YYYY-MM-DD account creation date. '' if unset/invalid. */
export function accountDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/**
 * How old the account is: "3d", "5mo", "2y 4mo". '' if unset/invalid.
 * Months are counted on the calendar, not as 30-day blocks, so an account made
 * on 3 March reads as exactly "1y" on 3 March the year after.
 */
export function accountAge(date: string | null, now: number = Date.now()): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date(now);
  if (d.getTime() > now) return 'future';

  let months =
    (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  if (today.getDate() < d.getDate()) months -= 1;

  if (months < 1) {
    const days = Math.floor((now - d.getTime()) / 86_400_000);
    return `${days}d`;
  }
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}y ${rest}mo` : `${years}y`;
}

/**
 * Heading for a date divider: "Today", "Yesterday", else "Tue 2 Sep 2026".
 * Takes a full timestamp (entries.created_at), not a date-only string.
 */
export function dayHeading(iso: string, now: number = Date.now()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Unknown date';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(then)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return then.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** A run of entries that share a calendar day, in list order. */
export interface DayGroup<T> {
  /** Local YYYY-MM-DD — stable key, unlike the display heading. */
  key: string;
  heading: string;
  items: T[];
}

/**
 * Splits rows into calendar-day groups, newest day first.
 *
 * Grouping is by LOCAL day, not the UTC date in the timestamp: an account added
 * at 01:00 CEST is stored as the previous day in UTC, and would otherwise land
 * under the wrong heading for the person who added it.
 *
 * Rows with a missing or unparseable date are collected into a final group
 * rather than dropped, so the list always accounts for every row.
 */
export function groupByDay<T>(
  rows: T[],
  getDate: (row: T) => string | null,
  now: number = Date.now(),
): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  const undated: T[] = [];

  for (const row of rows) {
    const raw = getDate(row);
    const when = raw ? new Date(raw) : null;
    if (!when || Number.isNaN(when.getTime())) {
      undated.push(row);
      continue;
    }
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(
      when.getDate(),
    ).padStart(2, '0')}`;
    const group = groups.get(key);
    if (group) group.items.push(row);
    else groups.set(key, { key, heading: dayHeading(raw as string, now), items: [row] });
  }

  const ordered = [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
  if (undated.length) {
    ordered.push({ key: 'undated', heading: 'No date', items: undated });
  }
  return ordered;
}
