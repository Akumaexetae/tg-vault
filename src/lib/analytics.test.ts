import { describe, expect, it } from 'vitest';
import {
  aggregate,
  bucketKey,
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

const ALL = { from: '1970-01-01', to: '2099-12-31' };

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
      ALL,
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
      ALL,
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
      ALL,
      'month',
    );
    expect(points).toHaveLength(1);
    expect(points[0].gross).toBe(1000); // not 2000
    expect(points[0].approximate).toBe(false);
  });

  it('falls back to the monthly figure where there is no daily detail', () => {
    const points = aggregate([], [month('b', '2026-06-01', 800)], [bella], ALL, 'month');
    expect(points[0].gross).toBe(800);
    expect(points[0].approximate).toBe(true);
  });

  it('mixes daily and monthly across different months without overlap', () => {
    const points = aggregate(
      [day('b', '2026-07-10', 400)],
      [month('b', '2026-06-01', 800), month('b', '2026-07-01', 999)],
      [bella],
      ALL,
      'month',
    );
    expect(points.map((p) => p.gross)).toEqual([800, 400]);
  });

  it('keeps precedence per creator, not globally', () => {
    // Bella has daily for July; Mia does not — Mia's monthly must still count.
    const points = aggregate(
      [day('b', '2026-07-10', 400)],
      [month('b', '2026-07-01', 999), month('m', '2026-07-01', 200)],
      [bella, mia],
      ALL,
      'month',
    );
    expect(points).toHaveLength(1);
    expect(points[0].gross).toBe(600); // 400 + 200, never 999
    expect(points[0].byCreator).toEqual({ b: 400, m: 200 });
  });

  it('splits each creator by her own share', () => {
    const points = aggregate(
      [day('b', '2026-07-10', 100), day('m', '2026-07-10', 100)],
      [],
      [bella, mia],
      ALL,
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
    expect(points).toHaveLength(1);
    expect(points[0].gross).toBe(20);
  });

  it('includes a month that only partly overlaps the range', () => {
    const points = aggregate(
      [],
      [month('b', '2026-07-01', 500)],
      [bella],
      { from: '2026-07-20', to: '2026-08-05' },
      'month',
    );
    expect(points).toHaveLength(1);
  });

  it('returns nothing rather than throwing when there is no data', () => {
    expect(aggregate([], [], [], ALL, 'month')).toEqual([]);
  });
});

describe('totalsFor', () => {
  it('totals, averages and finds the best bucket', () => {
    const points = aggregate(
      [day('b', '2026-07-27', 100), day('b', '2026-07-28', 300)],
      [],
      [bella],
      ALL,
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
});

describe('sensibleGranularity', () => {
  it('scales with the length of the range', () => {
    expect(sensibleGranularity({ from: '2026-07-01', to: '2026-07-14' })).toBe('day');
    expect(sensibleGranularity({ from: '2026-05-01', to: '2026-07-29' })).toBe('week');
    expect(sensibleGranularity({ from: '2025-01-01', to: '2026-07-29' })).toBe('month');
    expect(sensibleGranularity({ from: '2015-01-01', to: '2026-07-29' })).toBe('year');
  });
});
