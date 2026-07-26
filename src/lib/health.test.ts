import { describe, expect, it } from 'vitest';
import { healthReport, isOld, isWeak } from './health';
import type { Entry } from './types';

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e1',
  service_name: 'OnlyFans',
  service_key: 'onlyfans',
  service_url: '',
  creator_id: 'c1',
  username: 'u',
  password: 'Str0ng!Passw0rd',
  totp_secret: null,
  recovery: null,
  custom_fields: [],
  notes: null,
  proxy: null,
  pinned: false,
  history: [],
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
  ...over,
});

const NOW = new Date('2026-07-26T00:00:00Z').getTime();

describe('isWeak', () => {
  it('flags short, common, and single-class passwords', () => {
    expect(isWeak('abc123')).toBe(true);
    expect(isWeak('password')).toBe(true);
    expect(isWeak('aaaaaaaaaaaaaaa')).toBe(true);
  });

  it('accepts long mixed passwords', () => {
    expect(isWeak('Str0ng!Passw0rd')).toBe(false);
    expect(isWeak('correcthorse42')).toBe(false);
  });
});

describe('isOld', () => {
  it('flags entries untouched for more than 180 days', () => {
    expect(isOld(entry({ updated_at: '2025-11-01T00:00:00Z' }), NOW)).toBe(true);
    expect(isOld(entry({ updated_at: '2026-07-01T00:00:00Z' }), NOW)).toBe(false);
  });
});

describe('healthReport', () => {
  it('counts reused passwords across entries', () => {
    const list = [
      entry({ id: 'a', password: 'Sh4red!Secret' }),
      entry({ id: 'b', password: 'Sh4red!Secret' }),
      entry({ id: 'c', password: 'Un1que!Secret' }),
    ];
    const report = healthReport(list, NOW);
    expect(report.reused.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(report.total).toBe(3);
  });

  it('reports weak and old entries', () => {
    const report = healthReport(
      [entry({ id: 'w', password: '123456' }), entry({ id: 'o', updated_at: '2025-01-01T00:00:00Z' })],
      NOW,
    );
    expect(report.weak.map((e) => e.id)).toEqual(['w']);
    expect(report.old.map((e) => e.id)).toEqual(['o']);
  });
});
