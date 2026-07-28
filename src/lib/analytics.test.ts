import { describe, expect, it } from 'vitest';
import {
  aggregate,
  bucketKey,
  bucketsInRange,
  dataRange,
  bucketLabel,
  presetRange,
  previousRange,
  sensibleGranularity,
  totalsFor,
  weekStart,
} from './analytics';
import { makeCreator } from './creators/fixtures';
import type { CreatorDaily, CreatorEarning } from './types';

const bella = makeCreator({ id: 'b', name: 'Bella', revenue_share: 90 });
const mia = makeCreator({ id: 'm', name: 'Mia', revenue_share: 50 });

const day = (creator_id: string, d: string, gross: number): CreatorDaily => ({
  id: `${creator_id}-${d}`,
  creator_id,
  day: d,
  gross,
  currency: 'EUR',
  created_at: d,
  updated_by: 'Tyler',
});

const month = (creator_id: string, m: string, gross: number): CreatorEarning => ({
  id: `${creator_id}-${m}`,
  creator_id,
  month: m,
  gross,
  currency: 'EUR',
  notes: null,
  paid_at: null,
  paid_by: null,
  paid_reference: null,
  created_at: m,
  updated_by: 'Tyler',
});

// Ranges are now seeded with every bucket, so fixtures use real windows
// rather than a catch-all — a 1970→2099 span would zero-fill 400 buckets.
const JULY = { from: '2026-07-01', to: '2026-07-31' };
const JUN_JUL = { from: '2026-06-01', to: '2026-07-31' };

describe('weekStart', () => {
  it('returns the Monday of that week', () => {
    expect(weekStart('2026-07-29')).toBe('2026-07-27'); // Wed → Mon
    expect(weekStart('2026-07-27')).toBe('2026-07-27'); // Mon → itself
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(weekStart('2026-08-02')).toBe('2026-07-27');
  });
});

describe('bucketKey', () => {
  it('buckets by each granularity', () => {
    expect(bucketKey('2026-07-29', 'day')).toBe('2026-07-29');
    expect(bucketKey('2026-07-29', 'week')).toBe('2026-07-27');
    expect(bucketKey('2026-07-29', 'month')).toBe('2026-07-01');
    expect(bucketKey('2026-07-29', 'year')).toBe('2026-01-01');
  });
});

describe('bucketLabel', () => {
  it('labels a year as the plain year', () => {
    expect(bucketLabel('2026-01-01', 'year')).toBe('2026');
  });

  it('marks a week as week-commencing', () => {
    expect(bucketLabel('2026-07-27', 'week')).toMatch(/^w\/c /);
  });
});

describe('presetRange', () => {
  const now = new Date('2026-07-29T12:00:00Z');

  it('counts the last N days inclusive of today', () => {
    expect(presetRange('last7', now)).toEqual({ from: '2026-07-23', to: '2026-07-29' });
  });

  it('starts year-to-date on 1 January', () => {
    expect(presetRange('ytd', now).from).toBe('2026-01-01');
  });
});

describe('previousRange', () => {
  it('returns the equally long span immediately before', () => {
    expect(previousRange({ from: '2026-07-23', to: '2026-07-29' })).toEqual({
      from: '2026-07-16',
      to: '2026-07-22',
    });
  });
});

describe('aggregate', () => {
  it('sums daily rows into buckets and derives the split per creator', () => {
    const points = aggregate(
      [day('b', '2026-07-27', 100), day('b', '2026-07-28', 50)],
      [],
      [bella],
      { from: '2026-07-27', to: '2026-07-28' },
      'day',
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ key: '2026-07-27', gross: 100, agency: 90 });
  });

  it('rolls days into weeks', () => {
    const points = aggregate(
      [day('b', '2026-07-27', 100), day('b', '2026-07-29', 50)],
      [],
      [bella],
      { from: '2026-07-27', to: '2026-07-29' },
      'week',
    );
    expect(points).toHaveLength(1);
    expect(points[0].gross).toBe(150);
  });

  it('NEVER double-counts a month that also has daily detail', () => {
    // The dangerous case: both sources describe the same money.
    const points = aggregate(
      [day('b', '2026-07-10', 400), day('b', '2026-07-20', 600)],
      [month('b', '2026-07-01', 1000)],
      [bella],
      JULY,
      'month',
    );
    expect(points).toHaveLength(1);
    expect(points[0].gross).toBe(1000); // not 2000
    expect(points[0].approximate).toBe(false);
  });

  it('counts only the requested currency, like Money and the export do', () => {
    // A USD row must never be added into a total labelled EUR.
    const eur = { ...month('b', '2026-07-01', 1000), currency: 'EUR' };
    const usd = { ...month('m', '2026-07-01', 5000), currency: 'USD' };
    const points = aggregate([], [eur, usd], [bella, mia], JULY, 'month', 'EUR');
    expect(points[0].gross).toBe(1000);
    expect(points[0].byCreator.m).toBeUndefined();
  });

  it('counts every currency when none is specified', () => {
    const eur = { ...month('b', '2026-07-01', 1000), currency: 'EUR' };
    const usd = { ...month('m', '2026-07-01', 500), currency: 'USD' };
    const points = aggregate([], [eur, usd], [bella, mia], JULY, 'month');
    expect(points[0].gross).toBe(1500);
  });

  it('scales daily detail to the monthly figure, which is canonical', () => {
    // Monthly edited to 2000 after importing 1000 of daily detail. Every other
    // screen reads the monthly row, so the chart must total the same.
    const points = aggregate(
      [day('b', '2026-07-10', 400), day('b', '2026-07-20', 600)],
      [month('b', '2026-07-01', 2000)],
      [bella],
      JULY,
      'day',
    );
    const total = points.reduce((n, p) => n + p.gross, 0);
    expect(total).toBeCloseTo(2000, 2);
    // Shape is preserved: the 20th still carries 60% of the month.
    const twentieth = points.find((p) => p.key === '2026-07-20');
    expect(twentieth?.gross).toBeCloseTo(1200, 2);
  });

  it('leaves daily alone when there is no monthly figure to reconcile with', () => {
    const points = aggregate(
      [day('b', '2026-07-10', 400)],
      [],
      [bella],
      JULY,
      'day',
    );
    expect(points.find((p) => p.key === '2026-07-10')?.gross).toBe(400);
  });

  it('falls back to the monthly figure when daily rows sum to nothing', () => {
    const points = aggregate(
      [day('b', '2026-07-10', 0)],
      [month('b', '2026-07-01', 500)],
      [bella],
      JULY,
      'month',
    );
    expect(points[0].gross).toBe(500);
  });

  it('agrees with the monthly total that every other screen reads', () => {
    // The whole point of reconciliation: Money, Home and the export all read
    // creator_earnings, so the chart's month must equal it exactly.
    const monthly = [month('b', '2026-07-01', 1234.56), month('m', '2026-07-01', 765.44)];
    const points = aggregate(
      [day('b', '2026-07-05', 900), day('b', '2026-07-25', 100)],
      monthly,
      [bella, mia],
      JULY,
      'month',
    );
    const expected = monthly.reduce((n, m) => n + m.gross, 0);
    expect(points[0].gross).toBeCloseTo(expected, 2);
  });

  it('falls back to the monthly figure where there is no daily detail', () => {
    const points = aggregate(
      [],
      [month('b', '2026-06-01', 800)],
      [bella],
      { from: '2026-06-01', to: '2026-06-30' },
      'month',
    );
    expect(points[0].gross).toBe(800);
    expect(points[0].approximate).toBe(true);
  });

  it('mixes months with and without daily detail, monthly total intact', () => {
    // June has only a monthly figure; July has both. Both months report their
    // monthly figure, because that is the canonical number everywhere else.
    const points = aggregate(
      [day('b', '2026-07-10', 400)],
      [month('b', '2026-06-01', 800), month('b', '2026-07-01', 999)],
      [bella],
      JUN_JUL,
      'month',
    );
    expect(points.map((p) => p.gross)).toEqual([800, 999]);
  });

  it('reconciles per creator, not globally', () => {
    // Bella has daily detail for July, Mia does not. Both still contribute
    // exactly their monthly figure — 999 + 200.
    const points = aggregate(
      [day('b', '2026-07-10', 400)],
      [month('b', '2026-07-01', 999), month('m', '2026-07-01', 200)],
      [bella, mia],
      JULY,
      'month',
    );
    expect(points).toHaveLength(1);
    expect(points[0].gross).toBeCloseTo(1199, 2);
    expect(points[0].byCreator.b).toBeCloseTo(999, 2);
    expect(points[0].byCreator.m).toBeCloseTo(200, 2);
  });

  it('splits each creator by her own share', () => {
    const points = aggregate(
      [day('b', '2026-07-10', 100), day('m', '2026-07-10', 100)],
      [],
      [bella, mia],
      { from: '2026-07-10', to: '2026-07-10' },
      'day',
    );
    expect(points[0].agency).toBe(140); // 90 + 50
    expect(points[0].creators).toBe(60);
  });

  it('respects the range', () => {
    const points = aggregate(
      [day('b', '2026-07-01', 10), day('b', '2026-07-20', 20)],
      [],
      [bella],
      { from: '2026-07-15', to: '2026-07-31' },
      'day',
    );
    // Every day in the window is present; only the 20th carries money.
    const earning = points.filter((p) => p.gross > 0);
    expect(earning).toHaveLength(1);
    expect(earning[0]).toMatchObject({ key: '2026-07-20', gross: 20 });
  });

  it('includes a month that only partly overlaps the range', () => {
    const points = aggregate(
      [],
      [month('b', '2026-07-01', 500)],
      [bella],
      { from: '2026-07-20', to: '2026-08-05' },
      'month',
    );
    expect(points.filter((p) => p.gross > 0)).toHaveLength(1);
  });

  it('returns nothing rather than throwing when there is no data', () => {
    const points = aggregate([], [], [], JUN_JUL, 'month');
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.gross === 0)).toBe(true);
  });
});

describe('totalsFor', () => {
  it('totals, averages and finds the best bucket', () => {
    const points = aggregate(
      [day('b', '2026-07-27', 100), day('b', '2026-07-28', 300)],
      [],
      [bella],
      { from: '2026-07-27', to: '2026-07-28' },
      'day',
    );
    const t = totalsFor(points);
    expect(t.gross).toBe(400);
    expect(t.agency).toBe(360);
    expect(t.average).toBe(200);
    expect(t.best?.key).toBe('2026-07-28');
  });

  it('handles an empty series without dividing by zero', () => {
    expect(totalsFor([])).toMatchObject({ gross: 0, average: 0, best: null });
  });

  it('averages over the trading span, not the whole window', () => {
    // Twelve months on screen, two months of actual earnings.
    const points = aggregate(
      [],
      [month('b', '2026-06-01', 1000), month('b', '2026-07-01', 2000)],
      [bella],
      { from: '2025-08-01', to: '2026-07-31' },
      'month',
    );
    expect(points).toHaveLength(12);
    const t = totalsFor(points);
    expect(t.activePeriods).toBe(2);
    expect(t.average).toBe(1500); // not 3000/12 = 250
  });

  it('counts a quiet month inside the span, since that is a real zero', () => {
    const points = aggregate(
      [],
      [month('b', '2026-05-01', 900), month('b', '2026-07-01', 900)],
      [bella],
      { from: '2026-01-01', to: '2026-07-31' },
      'month',
    );
    const t = totalsFor(points);
    expect(t.activePeriods).toBe(3); // May, June (zero), July
    expect(t.average).toBe(600);
  });

  it('reports zero periods when nothing was earned at all', () => {
    const points = aggregate([], [], [], { from: '2026-01-01', to: '2026-03-31' }, 'month');
    expect(totalsFor(points)).toMatchObject({ activePeriods: 0, average: 0 });
  });
});

describe('sensibleGranularity', () => {
  it('scales with the length of the range', () => {
    expect(sensibleGranularity({ from: '2026-07-01', to: '2026-07-14' })).toBe('day');
    expect(sensibleGranularity({ from: '2026-05-01', to: '2026-07-29' })).toBe('week');
    expect(sensibleGranularity({ from: '2025-01-01', to: '2026-07-29' })).toBe('month');
    expect(sensibleGranularity({ from: '2015-01-01', to: '2026-07-29' })).toBe('year');
  });
});

describe('bucketsInRange', () => {
  it('lists every month in the range, including empty ones', () => {
    expect(bucketsInRange({ from: '2026-05-01', to: '2026-07-15' }, 'month')).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
    ]);
  });

  it('lists every day', () => {
    expect(bucketsInRange({ from: '2026-07-01', to: '2026-07-04' }, 'day')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it('steps weeks from the Monday of the first week', () => {
    const weeks = bucketsInRange({ from: '2026-07-01', to: '2026-07-20' }, 'week');
    expect(weeks[0]).toBe('2026-06-29');
    expect(weeks[1]).toBe('2026-07-06');
  });

  it('caps runaway ranges rather than generating thousands of buckets', () => {
    const many = bucketsInRange({ from: '1970-01-01', to: '2026-07-28' }, 'day');
    expect(many.length).toBeLessThanOrEqual(400);
  });
});

describe('dataRange', () => {
  const now = new Date('2026-07-28T00:00:00Z');

  it('spans the earliest record to today', () => {
    const r = dataRange(
      [day('b', '2026-05-10', 10)],
      [month('b', '2026-03-01', 10)],
      now,
    );
    expect(r).toEqual({ from: '2026-03-01', to: '2026-07-28' });
  });

  it('is null when there is nothing recorded', () => {
    expect(dataRange([], [], now)).toBeNull();
  });
});

describe('aggregate — empty buckets', () => {
  it('fills quiet months with zero rather than dropping them', () => {
    const points = aggregate(
      [],
      [month('b', '2026-05-01', 100), month('b', '2026-07-01', 300)],
      [bella],
      { from: '2026-05-01', to: '2026-07-31' },
      'month',
    );
    expect(points.map((p) => p.gross)).toEqual([100, 0, 300]);
  });

  it('does not mark an empty bucket as approximate — it has no source', () => {
    const points = aggregate(
      [],
      [month('b', '2026-05-01', 100)],
      [bella],
      { from: '2026-05-01', to: '2026-06-30' },
      'month',
    );
    expect(points[1].gross).toBe(0);
    expect(points[1].approximate).toBe(false);
  });
});
