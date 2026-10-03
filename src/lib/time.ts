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
