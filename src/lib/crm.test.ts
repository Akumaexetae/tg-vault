import { describe, expect, it } from 'vitest';
import { compactViews, indexByHandle, isStale, primaryCount, viewsFor } from './crm';

const payload = {
  accounts: [
    {
      handle: 'permesa.lola',
      platform: 'INSTAGRAM',
      impressions: 33_430,
      views: 641,
      measuredAt: '2026-10-08T02:00:00Z',
    },
    {
      handle: 'rivera.lo08',
      platform: 'INSTAGRAM',
      impressions: null,
      views: null,
      measuredAt: null,
    },
    {
      handle: 'threads.only',
      platform: 'THREADS',
      impressions: 999,
      views: 10,
      measuredAt: '2026-10-08T02:00:00Z',
    },
    {
      handle: null,
      platform: 'INSTAGRAM',
      impressions: 5,
      views: 1,
      measuredAt: null,
    },
  ],
};

describe('indexByHandle', () => {
  it('keeps only Instagram accounts that have a handle', () => {
    const index = indexByHandle(payload);
    expect([...index.keys()].sort()).toEqual(['permesa.lola', 'rivera.lo08']);
  });

  it('survives a null payload', () => {
    expect(indexByHandle(null).size).toBe(0);
  });
});

describe('viewsFor', () => {
  const index = indexByHandle(payload);

  it('matches regardless of the case the username was typed in', () => {
    expect(viewsFor('Permesa.lola', index)?.impressions).toBe(33_430);
    expect(viewsFor('PERMESA.LOLA', index)?.impressions).toBe(33_430);
  });

  it('matches a username carrying a label', () => {
    expect(viewsFor('rivera.lo08 FLASH', index)).not.toBeNull();
  });

  it('is null for an account the CRM does not have', () => {
    expect(viewsFor('not.connected', index)).toBeNull();
  });

  it('is null when the username is not a handle at all', () => {
    expect(viewsFor('someone@example.com', index)).toBeNull();
  });
});

describe('isStale', () => {
  const now = new Date('2026-10-08T12:00:00Z').getTime();

  it('accepts last night', () => {
    expect(isStale('2026-10-08T02:00:00Z', now)).toBe(false);
  });

  it('flags a snapshot older than two days', () => {
    expect(isStale('2026-10-04T02:00:00Z', now)).toBe(true);
  });

  it('treats never-measured and unparseable as stale', () => {
    expect(isStale(null, now)).toBe(true);
    expect(isStale('nonsense', now)).toBe(true);
  });
});

describe('compactViews', () => {
  it('formats for a narrow cell', () => {
    expect(compactViews(903)).toBe('903');
    expect(compactViews(1240)).toBe('1.2k');
    expect(compactViews(12_400)).toBe('12k');
    expect(compactViews(1_240_000)).toBe('1.2M');
  });

  it('shows a dash when there is no number', () => {
    expect(compactViews(null)).toBe('—');
  });
});

describe('the CRM response envelope', () => {
  it('reads the wrapped { ok, data } shape the CRM actually returns', () => {
    const index = indexByHandle({ ok: true, data: payload } as never);
    expect(index.get('permesa.lola')?.impressions).toBe(33_430);
  });

  it('still reads a bare report', () => {
    expect(indexByHandle(payload).get('permesa.lola')?.impressions).toBe(33_430);
  });
});

describe('primaryCount', () => {
  const index = indexByHandle(payload);

  it('uses impressions, because Instagram views7d is always null', () => {
    expect(primaryCount(viewsFor('permesa.lola', index))).toBe(33_430);
  });

  it('is null when the account has no figures at all', () => {
    expect(primaryCount(viewsFor('rivera.lo08', index))).toBeNull();
    expect(primaryCount(null)).toBeNull();
  });
});
