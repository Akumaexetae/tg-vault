import { describe, expect, it } from 'vitest';
import { accountAge, accountDate, dayHeading, groupByDay, timeAgo } from './time';

const NOW = new Date('2026-07-26T12:00:00Z').getTime();

describe('timeAgo', () => {
  it('formats recent times as relative', () => {
    expect(timeAgo('2026-07-26T11:59:30Z', NOW)).toBe('just now');
    expect(timeAgo('2026-07-26T11:55:00Z', NOW)).toBe('5m ago');
    expect(timeAgo('2026-07-26T10:00:00Z', NOW)).toBe('2h ago');
    expect(timeAgo('2026-07-23T12:00:00Z', NOW)).toBe('3d ago');
  });

  it('falls back to a date for old timestamps', () => {
    expect(timeAgo('2026-01-01T00:00:00Z', NOW)).toMatch(/2026/);
  });

  it('returns empty string for invalid input', () => {
    expect(timeAgo('garbage', NOW)).toBe('');
  });
});

describe('accountDate', () => {
  it('shows month and year', () => {
    expect(accountDate('2026-03-14')).toBe('Mar 2026');
  });

  it('returns empty string when unset or invalid', () => {
    expect(accountDate(null)).toBe('');
    expect(accountDate('')).toBe('');
    expect(accountDate('garbage')).toBe('');
  });
});

describe('accountAge', () => {
  it('counts days under a month', () => {
    expect(accountAge('2026-07-23', NOW)).toBe('3d');
  });

  it('counts whole months under a year', () => {
    expect(accountAge('2026-02-26', NOW)).toBe('5mo');
  });

  it('counts years, and drops the months when there are none', () => {
    expect(accountAge('2025-07-26', NOW)).toBe('1y');
    expect(accountAge('2024-03-26', NOW)).toBe('2y 4mo');
  });

  it('does not round a month up before the day of month is reached', () => {
    // 27 Jun -> 26 Jul is one day short of a full month.
    expect(accountAge('2026-06-27', NOW)).toBe('29d');
  });

  it('flags dates in the future rather than showing a negative age', () => {
    expect(accountAge('2027-01-01', NOW)).toBe('future');
  });

  it('returns empty string when unset or invalid', () => {
    expect(accountAge(null, NOW)).toBe('');
    expect(accountAge('garbage', NOW)).toBe('');
  });
});

describe('dayHeading', () => {
  const now = new Date('2026-10-04T12:00:00').getTime();

  it('names today and yesterday rather than printing a date', () => {
    expect(dayHeading('2026-10-04T09:30:00', now)).toBe('Today');
    expect(dayHeading('2026-10-03T23:50:00', now)).toBe('Yesterday');
  });

  it('prints a weekday and full date further back', () => {
    // Asserted loosely: the exact separators and month abbreviation come from
    // the runtime's locale data and differ between ICU builds.
    const heading = dayHeading('2026-09-02T10:00:00', now);
    expect(heading).toMatch(/^Wed/);
    expect(heading).toMatch(/Sep/);
    expect(heading).toContain(' 2 ');
    expect(heading).toMatch(/2026/);
  });

  it('survives an unparseable timestamp', () => {
    expect(dayHeading('not a date', now)).toBe('Unknown date');
  });
});

describe('groupByDay', () => {
  const now = new Date('2026-10-04T12:00:00').getTime();
  const row = (id: string, created_at: string | null) => ({ id, created_at });

  it('groups by calendar day, newest day first', () => {
    const groups = groupByDay(
      [
        row('a', '2026-09-02T10:00:00'),
        row('b', '2026-09-03T09:00:00'),
        row('c', '2026-09-02T18:00:00'),
      ],
      (r) => r.created_at,
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['2026-09-03', '2026-09-02']);
    expect(groups[1].items.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('keeps the order rows arrived in within a day', () => {
    const groups = groupByDay(
      [row('first', '2026-09-02T08:00:00'), row('second', '2026-09-02T20:00:00')],
      (r) => r.created_at,
      now,
    );
    expect(groups[0].items.map((r) => r.id)).toEqual(['first', 'second']);
  });

  it('collects undated and invalid rows into a final group instead of dropping them', () => {
    const groups = groupByDay(
      [row('ok', '2026-09-02T10:00:00'), row('none', null), row('bad', 'nonsense')],
      (r) => r.created_at,
      now,
    );
    const last = groups[groups.length - 1];
    expect(last.key).toBe('undated');
    expect(last.items.map((r) => r.id)).toEqual(['none', 'bad']);
    // every row is accounted for
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(3);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([], () => null, now)).toEqual([]);
  });
});
