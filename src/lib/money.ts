import { splitEarning, monthKey } from './creators/earnings';
import type { Creator, CreatorEarning } from './types';

export interface CurrencyTotal {
  currency: string;
  gross: number;
  agency: number;
  creators: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Totals for one month, grouped by currency.
 *
 * Grouped rather than summed flat because each creator carries her own
 * currency — adding EUR to USD would produce a confident wrong number. Each
 * creator's split uses HER share, never a blended rate.
 */
export function monthTotals(
  earnings: CreatorEarning[],
  creators: Creator[],
  month: string,
): CurrencyTotal[] {
  const key = monthKey(month);
  const shareOf = new Map(creators.map((c) => [c.id, c.revenue_share]));
  const byCurrency = new Map<string, CurrencyTotal>();

  for (const earning of earnings) {
    if (monthKey(earning.month) !== key) continue;
    const currency = earning.currency || 'EUR';
    const split = splitEarning(earning.gross, shareOf.get(earning.creator_id) ?? null);
    const row = byCurrency.get(currency) ?? {
      currency,
      gross: 0,
      agency: 0,
      creators: 0,
    };
    row.gross = round2(row.gross + earning.gross);
    row.agency = round2(row.agency + split.agency);
    row.creators = round2(row.creators + split.creator);
    byCurrency.set(currency, row);
  }

  return [...byCurrency.values()].sort((a, b) => b.gross - a.gross);
}

/**
 * Percentage change, or null when there's no meaningful comparison —
 * a previous month of zero has no percentage, and "+∞%" helps nobody.
 */
export function monthDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** ISO first-of-month for `back` months before `now`. */
export function monthsAgo(back: number, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  return monthKey(d.toISOString());
}

/** Agency cut per month for the trend chart, in one currency, zero-filled. */
export function agencySeries(
  earnings: CreatorEarning[],
  creators: Creator[],
  currency: string,
  now: Date = new Date(),
  months = 6,
): { month: string; agency: number }[] {
  const series: { month: string; agency: number }[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const month = monthsAgo(back, now);
    const row = monthTotals(earnings, creators, month).find(
      (t) => t.currency === currency,
    );
    series.push({ month, agency: row?.agency ?? 0 });
  }
  return series;
}

/**
 * Active creators with nothing recorded for the month — the ones worth
 * chasing. Archived, paused and the agency row are not chased.
 */
export function creatorsMissingEarnings(
  creators: Creator[],
  earnings: CreatorEarning[],
  month: string,
): Creator[] {
  const key = monthKey(month);
  const recorded = new Set(
    earnings.filter((e) => monthKey(e.month) === key).map((e) => e.creator_id),
  );
  return creators.filter(
    (c) => c.kind === 'creator' && c.status === 'active' && !recorded.has(c.id),
  );
}

/** Gross per creator for the month, highest first. */
export function grossByCreator(
  earnings: CreatorEarning[],
  month: string,
): { creator_id: string; gross: number; currency: string }[] {
  const key = monthKey(month);
  return earnings
    .filter((e) => monthKey(e.month) === key)
    .map((e) => ({
      creator_id: e.creator_id,
      gross: e.gross,
      currency: e.currency || 'EUR',
    }))
    .sort((a, b) => b.gross - a.gross);
}
