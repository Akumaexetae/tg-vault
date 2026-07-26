import type { CreatorEarning } from '../types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Agency cut and creator payout, derived from the current share.
 *
 * Never stored (spec §4): a later share change must not silently rewrite
 * history, and keeping both gross and split invites them to disagree.
 */
export function splitEarning(
  gross: number,
  sharePercent: number | null,
): { agency: number; creator: number } {
  const share = sharePercent ?? 0;
  const agency = round2((gross * share) / 100);
  // Creator takes the remainder, so the two always add back to gross.
  return { agency, creator: round2(gross - agency) };
}

/** Normalise any date to the first of its month, as an ISO date string. */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-01`;
}

/** Six month slots ending with the current month, zero-filled for the chart. */
export function lastSixMonths(
  earnings: CreatorEarning[],
  now: Date = new Date(),
): { month: string; gross: number }[] {
  const byMonth = new Map(earnings.map((e) => [monthKey(e.month), e.gross]));
  const slots: { month: string; gross: number }[] = [];
  for (let back = 5; back >= 0; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = monthKey(d.toISOString());
    slots.push({ month: key, gross: byMonth.get(key) ?? 0 });
  }
  return slots;
}
