import { describe, expect, it } from 'vitest';
import {
  agencySeries,
  creatorsMissingEarnings,
  grossByCreator,
  monthDelta,
  monthsAgo,
  monthTotals,
} from './money';
import { makeCreator } from './creators/fixtures';
import type { CreatorEarning } from './types';

const earning = (
  creator_id: string,
  month: string,
  gross: number,
  currency = 'EUR',
): CreatorEarning => ({
  id: `${creator_id}-${month}`,
  creator_id,
  month,
  gross,
  currency,
  notes: null,
  paid_at: null,
  paid_by: null,
  paid_reference: null,
  created_at: month,
  updated_by: 'Tyler',
});

const bella = makeCreator({ id: 'bella', name: 'Bella', revenue_share: 45 });
const mia = makeCreator({ id: 'mia', name: 'Mia', revenue_share: 20 });
const agency = makeCreator({ id: 'agency', name: 'Agency', kind: 'agency' });

describe('monthTotals', () => {
  it('splits each creator by HER own share, not a blended rate', () => {
    const totals = monthTotals(
      [earning('bella', '2026-07-01', 1000), earning('mia', '2026-07-01', 1000)],
      [bella, mia],
      '2026-07-01',
    );
    // 45% of 1000 = 450, 20% of 1000 = 200 → 650, not 32.5% of 2000 = 650… which
    // happens to match here only by coincidence, so use uneven grosses too.
    expect(totals).toHaveLength(1);
    expect(totals[0]).toEqual({
      currency: 'EUR',
      gross: 2000,
      agency: 650,
      creators: 1350,
    });
  });

  it('is not fooled by uneven grosses', () => {
    const totals = monthTotals(
      [earning('bella', '2026-07-01', 2000), earning('mia', '2026-07-01', 500)],
      [bella, mia],
      '2026-07-01',
    );
    // 45% of 2000 = 900, 20% of 500 = 100 → 1000. A blended rate would differ.
    expect(totals[0].agency).toBe(1000);
    expect(totals[0].creators).toBe(1500);
  });

  it('groups by currency rather than adding EUR to USD', () => {
    const totals = monthTotals(
      [
        earning('bella', '2026-07-01', 1000, 'EUR'),
        earning('mia', '2026-07-01', 800, 'USD'),
      ],
      [bella, mia],
      '2026-07-01',
    );
    expect(totals).toHaveLength(2);
    expect(totals.map((t) => t.currency)).toEqual(['EUR', 'USD']);
    expect(totals.find((t) => t.currency === 'USD')?.agency).toBe(160);
  });

  it('ignores other months', () => {
    const totals = monthTotals(
      [earning('bella', '2026-06-01', 999)],
      [bella],
      '2026-07-01',
    );
    expect(totals).toEqual([]);
  });

  it('treats a creator with no share as owing the agency nothing', () => {
    const noShare = makeCreator({ id: 'x', revenue_share: null });
    const totals = monthTotals(
      [earning('x', '2026-07-01', 500)],
      [noShare],
      '2026-07-01',
    );
    expect(totals[0]).toEqual({
      currency: 'EUR',
      gross: 500,
      agency: 0,
      creators: 500,
    });
  });
});

describe('monthDelta', () => {
  it('reports percentage change', () => {
    expect(monthDelta(120, 100)).toBe(20);
    expect(monthDelta(80, 100)).toBe(-20);
  });

  it('returns null rather than infinity when the previous month was zero', () => {
    expect(monthDelta(500, 0)).toBeNull();
  });
});

describe('monthsAgo', () => {
  it('walks back across a year boundary', () => {
    const now = new Date('2026-02-10T00:00:00Z');
    expect(monthsAgo(0, now)).toBe('2026-02-01');
    expect(monthsAgo(5, now)).toBe('2025-09-01');
  });
});

describe('agencySeries', () => {
  it('returns a zero-filled six-month series of the agency cut', () => {
    const series = agencySeries(
      [earning('bella', '2026-07-01', 1000), earning('bella', '2026-05-01', 200)],
      [bella],
      'EUR',
      new Date('2026-07-15T00:00:00Z'),
    );
    expect(series).toHaveLength(6);
    expect(series[5]).toEqual({ month: '2026-07-01', agency: 450 });
    expect(series[4]).toEqual({ month: '2026-06-01', agency: 0 });
    expect(series[3]).toEqual({ month: '2026-05-01', agency: 90 });
  });
});

describe('creatorsMissingEarnings', () => {
  it('lists active creators with nothing recorded', () => {
    const missing = creatorsMissingEarnings(
      [bella, mia],
      [earning('bella', '2026-07-01', 100)],
      '2026-07-01',
    );
    expect(missing.map((c) => c.id)).toEqual(['mia']);
  });

  it('never chases archived, paused or agency rows', () => {
    const ended = makeCreator({ id: 'lena', status: 'ended' });
    const paused = makeCreator({ id: 'nina', status: 'paused' });
    const missing = creatorsMissingEarnings(
      [ended, paused, agency],
      [],
      '2026-07-01',
    );
    expect(missing).toEqual([]);
  });
});

describe('grossByCreator', () => {
  it('orders creators by gross, highest first', () => {
    const rows = grossByCreator(
      [earning('mia', '2026-07-01', 500), earning('bella', '2026-07-01', 900)],
      '2026-07-01',
    );
    expect(rows.map((r) => r.creator_id)).toEqual(['bella', 'mia']);
  });
});
