import { describe, expect, it } from 'vitest';
import { accountAge, accountDate, timeAgo } from './time';

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
