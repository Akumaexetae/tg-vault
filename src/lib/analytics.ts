import { splitEarning } from './creators/earnings';
import type { Creator, CreatorDaily, CreatorEarning } from './types';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export type RangePreset =
  | 'last7'
  | 'last30'
  | 'last90'
  | 'last365'
  | 'ytd'
  | 'all'
  | 'custom';

export interface DateRange {
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive, YYYY-MM-DD
}

export interface Point {
  key: string;
  label: string;
  gross: number;
  agency: number;
  creators: number;
  /** Gross per creator id, for the breakdown view. */
  byCreator: Record<string, number>;
  /** True when this bucket came from monthly figures rather than daily detail. */
  approximate: boolean;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// --- Bucketing ------------------------------------------------------------

/** Monday of the week containing `date`, ISO-style. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const back = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return iso(d);
}

export function bucketKey(date: string, granularity: Granularity): string {
  switch (granularity) {
    case 'day':
      return date.slice(0, 10);
    case 'week':
      return weekStart(date.slice(0, 10));
    case 'month':
      return `${date.slice(0, 7)}-01`;
    case 'year':
      return `${date.slice(0, 4)}-01-01`;
  }
}

export function bucketLabel(key: string, granularity: Granularity): string {
  const d = new Date(`${key}T00:00:00Z`);
  switch (granularity) {
    case 'day':
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    case 'week':
      return `w/c ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
    case 'month':
      return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    case 'year':
      return String(d.getUTCFullYear());
  }
}

// --- Ranges ---------------------------------------------------------------

export function presetRange(preset: RangePreset, now: Date = new Date()): DateRange {
  const to = iso(now);
  const back = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days + 1);
    return iso(d);
  };
  switch (preset) {
    case 'last7':
      return { from: back(7), to };
    case 'last30':
      return { from: back(30), to };
    case 'last90':
      return { from: back(90), to };
    case 'last365':
      return { from: back(365), to };
    case 'ytd':
      return { from: `${now.getUTCFullYear()}-01-01`, to };
    case 'all':
      return { from: '1970-01-01', to };
    case 'custom':
      return { from: back(30), to };
  }
}

/** The equally-long range immediately before this one, for comparison. */
export function previousRange(range: DateRange): DateRange {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - span + 1);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

/**
 * The span the data actually covers, so "all time" doesn't mean 1970.
 * Null when there is no data at all.
 */
export function dataRange(
  daily: CreatorDaily[],
  monthly: CreatorEarning[],
  now: Date = new Date(),
): DateRange | null {
  const dates = [
    ...daily.map((d) => d.day.slice(0, 10)),
    ...monthly.map((m) => m.month.slice(0, 10)),
  ];
  if (dates.length === 0) return null;
  return { from: dates.reduce((a, b) => (a < b ? a : b)), to: iso(now) };
}

const MAX_BUCKETS = 400;

/**
 * Every bucket in the range, including empty ones — a month you earned
 * nothing in is a real zero, not a gap to be closed up.
 *
 * Capped: a wide range at day granularity would otherwise generate thousands
 * of buckets and freeze the chart. Past the cap the caller should coarsen.
 */
export function bucketsInRange(
  range: DateRange,
  granularity: Granularity,
): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${bucketKey(range.from, granularity)}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);

  while (cursor <= end && keys.length < MAX_BUCKETS) {
    keys.push(iso(cursor));
    switch (granularity) {
      case 'day':
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        break;
      case 'week':
        cursor.setUTCDate(cursor.getUTCDate() + 7);
        break;
      case 'month':
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        break;
      case 'year':
        cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
        break;
    }
  }
  return keys;
}

// --- Aggregation ----------------------------------------------------------

const monthKeyOf = (creatorId: string, date: string) =>
  `${creatorId}|${date.slice(0, 7)}`;

/**
 * How to reconcile the two sources for the same money.
 *
 * `creator_earnings` (monthly) is canonical — it is what payouts, Home, the
 * accountant export and the reminders all read. `creator_daily` exists only to
 * give shape *within* a month.
 *
 * So where both exist, the daily values are SCALED to sum to the monthly
 * figure rather than replacing it. Without this, editing a month by hand after
 * importing a statement left the chart showing one number and every other
 * screen showing another.
 *
 * Returns a multiplier per creator+month, and the set of months whose monthly
 * row is therefore already represented by daily rows.
 */
function reconcile(
  daily: CreatorDaily[],
  monthly: CreatorEarning[],
): { scale: Map<string, number>; handledByDaily: Set<string> } {
  const dailySums = new Map<string, number>();
  for (const d of daily) {
    const key = monthKeyOf(d.creator_id, d.day);
    dailySums.set(key, (dailySums.get(key) ?? 0) + d.gross);
  }

  const scale = new Map<string, number>();
  const handledByDaily = new Set<string>();

  for (const [key, sum] of dailySums) {
    // Daily with no monthly counterpart stands on its own.
    if (sum > 0) handledByDaily.add(key);
  }

  for (const m of monthly) {
    const key = monthKeyOf(m.creator_id, m.month);
    const sum = dailySums.get(key);
    if (sum === undefined || sum <= 0) {
      // No usable daily detail — the monthly figure is used directly.
      handledByDaily.delete(key);
      continue;
    }
    scale.set(key, m.gross / sum);
  }

  return { scale, handledByDaily };
}

export function aggregate(
  daily: CreatorDaily[],
  monthly: CreatorEarning[],
  creators: Creator[],
  range: DateRange,
  granularity: Granularity,
  /*
   * Only rows in this currency are counted. Money and the accountant export
   * both keep their totals per currency and never add EUR to USD; the chart
   * has to do the same, or it would sum both and label the result with one.
   * Omit to count everything (correct only while a single currency is in use).
   */
  currency?: string,
): Point[] {
  const inScope = (rowCurrency: string) =>
    !currency || (rowCurrency || 'EUR') === currency;
  daily = daily.filter((d) => inScope(d.currency));
  monthly = monthly.filter((m) => inScope(m.currency));

  const shareOf = new Map(creators.map((c) => [c.id, c.revenue_share]));
  const { scale, handledByDaily } = reconcile(daily, monthly);
  const buckets = new Map<string, Point>();

  // Seed every bucket in the range so quiet periods read as zero rather than
  // disappearing and making the line look continuous when it isn't.
  for (const key of bucketsInRange(range, granularity)) {
    buckets.set(key, {
      key,
      label: bucketLabel(key, granularity),
      gross: 0,
      agency: 0,
      creators: 0,
      byCreator: {},
      approximate: false,
    });
  }

  const add = (
    date: string,
    creatorId: string,
    gross: number,
    approximate: boolean,
  ) => {
    const key = bucketKey(date, granularity);
    const point = buckets.get(key) ?? {
      key,
      label: bucketLabel(key, granularity),
      gross: 0,
      agency: 0,
      creators: 0,
      byCreator: {},
      approximate: false,
    };
    const split = splitEarning(gross, shareOf.get(creatorId) ?? null);
    point.gross = round2(point.gross + gross);
    point.agency = round2(point.agency + split.agency);
    point.creators = round2(point.creators + split.creator);
    point.byCreator[creatorId] = round2((point.byCreator[creatorId] ?? 0) + gross);
    point.approximate = point.approximate || approximate;
    buckets.set(key, point);
  };

  for (const d of daily) {
    const day = d.day.slice(0, 10);
    if (day < range.from || day > range.to) continue;
    const factor = scale.get(monthKeyOf(d.creator_id, d.day)) ?? 1;
    add(day, d.creator_id, round2(d.gross * factor), false);
  }

  for (const m of monthly) {
    if (handledByDaily.has(monthKeyOf(m.creator_id, m.month))) continue;
    const month = m.month.slice(0, 10);
    // A monthly figure belongs to the range if any part of its month does.
    const monthEnd = `${m.month.slice(0, 7)}-31`;
    if (monthEnd < range.from || month > range.to) continue;
    add(month, m.creator_id, m.gross, true);
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface Totals {
  gross: number;
  agency: number;
  creators: number;
  best: Point | null;
  average: number;
  /** Periods the average is divided by — the operating span, not the window. */
  activePeriods: number;
}

export function totalsFor(points: Point[]): Totals {
  const gross = round2(points.reduce((n, p) => n + p.gross, 0));
  const agency = round2(points.reduce((n, p) => n + p.agency, 0));
  const creatorsTotal = round2(points.reduce((n, p) => n + p.creators, 0));
  const best = points.reduce<Point | null>(
    (top, p) => (!top || p.gross > top.gross ? p : top),
    null,
  );

  /*
   * Average across the span you actually traded, not the whole window.
   *
   * Buckets are zero-filled for the chart, so dividing by every bucket in a
   * 12-month view would divide two months of earnings by thirteen and report
   * an average five times lower than any month you've had. A genuine quiet
   * month INSIDE the span still counts — only the empty run before your first
   * record and after your last is excluded.
   */
  let first = -1;
  let last = -1;
  points.forEach((p, i) => {
    if (p.gross > 0) {
      if (first === -1) first = i;
      last = i;
    }
  });
  const activePeriods = first === -1 ? 0 : last - first + 1;

  return {
    gross,
    agency,
    creators: creatorsTotal,
    best,
    activePeriods,
    average: activePeriods ? round2(gross / activePeriods) : 0,
  };
}

/**
 * The granularity a range can actually support.
 *
 * Showing 400 daily points across a year is unreadable, and offering "day" for
 * a range with no daily data would draw a chart of nothing.
 */
export function sensibleGranularity(range: DateRange): Granularity {
  const days =
    (new Date(`${range.to}T00:00:00Z`).getTime() -
      new Date(`${range.from}T00:00:00Z`).getTime()) /
      86_400_000 +
    1;
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  if (days <= 1100) return 'month';
  return 'year';
}
