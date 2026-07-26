import { describe, expect, it } from 'vitest';
import { changedFieldNames } from './activity';
import type { Creator, CreatorInput } from '../types';

const base: CreatorInput = {
  name: 'Bella',
  color: '#f0a',
  kind: 'creator',
  status: 'active',
  legal_name: 'Isabella M.',
  date_of_birth: null,
  nationality: null,
  id_reference: null,
  email: null,
  phone: null,
  telegram: null,
  timezone: null,
  revenue_share: 45,
  start_date: null,
  contract_status: 'signed',
  notice_period_days: null,
  minimum_guarantee: null,
  payout_method: 'iban',
  payout_details: 'FR76 3000 1111',
  payout_currency: 'EUR',
  payout_schedule: 'monthly',
  of_url: null,
  getmysocial_url: null,
  socials: [],
  subscriber_count: null,
  subscriber_count_as_of: null,
  drive_folder_url: null,
  avatar_path: null,
};

const before: Creator = {
  ...base,
  id: 'c1',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
};

describe('changedFieldNames', () => {
  it('names the fields that changed', () => {
    expect(changedFieldNames(before, { ...base, revenue_share: 30 })).toEqual([
      'revenue share',
    ]);
  });

  it('NEVER includes the value of a sensitive field', () => {
    const changed = changedFieldNames(before, {
      ...base,
      payout_details: 'FR76 9999 SECRET',
    });
    expect(changed).toEqual(['payout details']);
    expect(changed.join(' ')).not.toContain('9999');
    expect(changed.join(' ')).not.toContain('SECRET');
  });

  it('never leaks an ID reference either', () => {
    const changed = changedFieldNames(before, {
      ...base,
      id_reference: 'FR passport 123456789',
    });
    expect(changed).toEqual(['ID reference']);
    expect(changed.join(' ')).not.toContain('123456789');
  });

  it('returns an empty list when nothing changed', () => {
    expect(changedFieldNames(before, { ...base })).toEqual([]);
  });

  it('detects changes inside the socials list', () => {
    expect(
      changedFieldNames(before, {
        ...base,
        socials: [{ label: 'X', url: 'https://x.com/bella' }],
      }),
    ).toEqual(['socials']);
  });

  it('reports several changed fields together', () => {
    expect(
      changedFieldNames(before, { ...base, revenue_share: 30, status: 'paused' }),
    ).toEqual(['status', 'revenue share']);
  });
});
