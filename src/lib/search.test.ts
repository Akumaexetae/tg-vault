import { describe, expect, it } from 'vitest';
import { entryLabel, filterEntries, matchesCreator, matchesQuery } from './search';
import { makeCreator } from './creators/fixtures';
import type { Creator, Entry } from './types';

const creators: Creator[] = [
  makeCreator({ id: 'c1', name: 'Bella', color: '#f0a' }),
  makeCreator({ id: 'c2', name: 'Agency', color: '#00AFF0', kind: 'agency' }),
];

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e1',
  service_name: 'OnlyFans',
  service_key: 'onlyfans',
  service_url: 'https://onlyfans.com',
  creator_id: 'c1',
  username: 'bella@of.com',
  password: 'pw',
  totp_secret: null,
  recovery: null,
  custom_fields: [],
  notes: null,
  proxy: null,
  pinned: false,
  history: [],
  created_at: '2026-07-26T00:00:00Z',
  updated_at: '2026-07-26T00:00:00Z',
  updated_by: 'Tyler',
  ...over,
});

describe('matchesQuery', () => {
  it('matches service, creator, username and notes, case-insensitively', () => {
    const e = entry({ notes: 'proxy via SMSPool' });
    expect(matchesQuery(e, 'Bella', 'onlyf')).toBe(true);
    expect(matchesQuery(e, 'Bella', 'BELLA')).toBe(true);
    expect(matchesQuery(e, 'Bella', 'of.com')).toBe(true);
    expect(matchesQuery(e, 'Bella', 'smspool')).toBe(true);
    expect(matchesQuery(e, 'Bella', 'tiktok')).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(matchesQuery(entry({}), 'Bella', '  ')).toBe(true);
  });
});

describe('filterEntries', () => {
  it('filters by creator name via the creator list', () => {
    const list = [entry({}), entry({ id: 'e2', creator_id: 'c2', username: 'tools@tg.com' })];
    expect(filterEntries(list, creators, 'agency').map((e) => e.id)).toEqual(['e2']);
  });
});

describe('matchesCreator', () => {
  const bella = makeCreator({
    legal_name: 'Isabella Moreau',
    email: 'bella@mail.com',
    telegram: '@bella_x',
    payout_details: 'FR76 3000 SECRET',
    id_reference: 'FR passport 998877',
  });

  it('matches stage name, legal name, email and Telegram', () => {
    expect(matchesCreator(bella, 'bella')).toBe(true);
    expect(matchesCreator(bella, 'moreau')).toBe(true);
    expect(matchesCreator(bella, 'bella@mail')).toBe(true);
    expect(matchesCreator(bella, '@bella_x')).toBe(true);
  });

  it('never matches payout details or ID references', () => {
    expect(matchesCreator(bella, 'SECRET')).toBe(false);
    expect(matchesCreator(bella, 'FR76')).toBe(false);
    expect(matchesCreator(bella, '998877')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesCreator(bella, '  ')).toBe(true);
  });
});

describe('entryLabel', () => {
  it("formats as \"Creator's Service (username)\"", () => {
    expect(entryLabel(entry({}), creators)).toBe("Bella's OnlyFans (bella@of.com)");
  });

  it('handles a missing creator gracefully', () => {
    expect(entryLabel(entry({ creator_id: 'ghost' }), creators)).toBe('OnlyFans (bella@of.com)');
  });
});
