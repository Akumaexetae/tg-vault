import { describe, expect, it } from 'vitest';
import { lastSixMonths, monthKey, splitEarning } from './earnings';
import type { CreatorEarning } from '../types';

const earning = (month: string, gross: number): CreatorEarning => ({
  id: month,
  creator_id: 'c1',
  month,
  gross,
  currency: 'EUR',
  notes: null,
  paid_at: null,
  paid_by: null,
  paid_reference: null,
  created_at: month,
  updated_by: 'Tyler',
});

describe('splitEarning', () => {
  it('splits gross by the agency share', () => {
    expect(splitEarning(1000, 45)).toEqual({ agency: 450, creator: 550 });
  });

  it('rounds to cents without losing a penny', () => {
    const { agency, creator } = splitEarning(100.01, 33);
    expect(agency + creator).toBeCloseTo(100.01, 2);
  });

  it('treats an unset share as nothing owed to the agency', () => {
    expect(splitEarning(500, null)).toEqual({ agency: 0, creator: 500 });
  });

  it('handles the full range', () => {
    expect(splitEarning(200, 0)).toEqual({ agency: 0, creator: 200 });
    expect(splitEarning(200, 100)).toEqual({ agency: 200, creator: 0 });
  });
});

describe('monthKey', () => {
  it('normalises any date to the first of its month', () => {
    expect(monthKey('2026-07-26T12:00:00Z')).toBe('2026-07-01');
    expect(monthKey('2026-01-01')).toBe('2026-01-01');
  });
});

describe('lastSixMonths', () => {
  it('returns six slots ending with the current month, zero-filling gaps', () => {
    const series = lastSixMonths(
      [earning('2026-07-01', 900), earning('2026-05-01', 400)],
      new Date('2026-07-15T00:00:00Z'),
    );
    expect(series).toHaveLength(6);
    expect(series[5]).toEqual({ month: '2026-07-01', gross: 900 });
    expect(series[4]).toEqual({ month: '2026-06-01', gross: 0 });
    expect(series[3]).toEqual({ month: '2026-05-01', gross: 400 });
  });

  it('crosses a year boundary correctly', () => {
    const series = lastSixMonths([], new Date('2026-02-10T00:00:00Z'));
    expect(series[0].month).toBe('2025-09-01');
    expect(series[5].month).toBe('2026-02-01');
  });
});
