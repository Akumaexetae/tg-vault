import type { Creator } from '../types';

/**
 * A complete Creator for tests. `Creator` has ~30 fields; without this every
 * test file would restate them and drift apart as the type evolves.
 */
export function makeCreator(over: Partial<Creator> = {}): Creator {
  return {
    id: 'c1',
    name: 'Bella',
    color: '#e91e8c',
    kind: 'creator',
    status: 'active',
    legal_name: null,
    date_of_birth: null,
    nationality: null,
    id_reference: null,
    email: null,
    phone: null,
    telegram: null,
    timezone: null,
    revenue_share: 45,
    start_date: null,
    contract_status: 'none',
    notice_period_days: null,
    minimum_guarantee: null,
    payout_method: null,
    payout_details: null,
    payout_currency: null,
    payout_schedule: null,
    of_url: null,
    getmysocial_url: null,
    socials: [],
    subscriber_count: null,
    subscriber_count_as_of: null,
    drive_folder_url: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    updated_by: 'Tyler',
    ...over,
  };
}
