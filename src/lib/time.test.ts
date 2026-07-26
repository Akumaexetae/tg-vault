import { describe, expect, it } from 'vitest';
import { timeAgo } from './time';

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
