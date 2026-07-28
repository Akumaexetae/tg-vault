import { describe, expect, it } from 'vitest';
import { buildReminders } from './reminders';
import { makeCreator } from './creators/fixtures';
import type { CreatorEarning } from './types';

const NOW = new Date('2026-07-28T12:00:00Z').getTime();
const MONTH = '2026-07-01';

const earning = (
  over: Partial<CreatorEarning> & { creator_id: string; month: string; gross: number },
): CreatorEarning => ({
  id: `${over.creator_id}-${over.month}`,
  currency: 'EUR',
  notes: null,
  paid_at: null,
  paid_by: null,
  paid_reference: null,
  created_at: over.month,
  updated_by: 'Tyler',
  ...over,
});

const bella = makeCreator({
  id: 'b',
  name: 'Bella',
  revenue_share: 45,
  contract_status: 'signed',
});

describe('buildReminders', () => {
  it('flags money still owed, with the amount worked out', () => {
    const r = buildReminders(
      [bella],
      [earning({ creator_id: 'b', month: MONTH, gross: 1000 })],
      MONTH,
      NOW,
    );
    const unpaid = r.find((x) => x.kind === 'unpaid');
    expect(unpaid?.message).toContain('550');
    expect(unpaid?.message).toContain('Bella');
  });

  it('does not flag a month already paid', () => {
    const r = buildReminders(
      [bella],
      [earning({ creator_id: 'b', month: MONTH, gross: 1000, paid_at: '2026-07-20T00:00:00Z' })],
      MONTH,
      NOW,
    );
    expect(r.some((x) => x.kind === 'unpaid')).toBe(false);
  });

  it('sorts older debts above newer ones', () => {
    const r = buildReminders(
      [bella],
      [
        earning({ creator_id: 'b', month: '2026-07-01', gross: 100 }),
        earning({ creator_id: 'b', month: '2026-02-01', gross: 100 }),
      ],
      MONTH,
      NOW,
    );
    const unpaid = r.filter((x) => x.kind === 'unpaid');
    expect(unpaid[0].message).toContain('2026-02');
  });

  it('flags unsigned and missing contracts differently', () => {
    const sent = makeCreator({ id: 's', name: 'Sent', contract_status: 'sent', revenue_share: 40 });
    const none = makeCreator({ id: 'n', name: 'None', contract_status: 'none', revenue_share: 40 });
    const r = buildReminders([sent, none], [], MONTH, NOW);
    expect(r.find((x) => x.creatorId === 's')?.message).toMatch(/sent but not signed/);
    expect(r.find((x) => x.creatorId === 'n' && x.kind === 'unsigned-contract')?.message)
      .toMatch(/no contract on file/);
  });

  it('flags a missing revenue share, since it silently zeroes the splits', () => {
    const noShare = makeCreator({ id: 'x', name: 'Xena', revenue_share: null, contract_status: 'signed' });
    const r = buildReminders([noShare], [], MONTH, NOW);
    expect(r.some((x) => x.kind === 'no-share')).toBe(true);
  });

  it('flags a stale subscriber count but not a fresh one', () => {
    const stale = makeCreator({
      id: 'a', name: 'Stale', contract_status: 'signed', revenue_share: 40,
      subscriber_count: 100, subscriber_count_as_of: '2026-01-01',
    });
    const fresh = makeCreator({
      id: 'f', name: 'Fresh', contract_status: 'signed', revenue_share: 40,
      subscriber_count: 100, subscriber_count_as_of: '2026-07-20',
    });
    const r = buildReminders([stale, fresh], [], MONTH, NOW);
    expect(r.some((x) => x.kind === 'stale-subscribers' && x.creatorId === 'a')).toBe(true);
    expect(r.some((x) => x.kind === 'stale-subscribers' && x.creatorId === 'f')).toBe(false);
  });

  it('flags a creator with nothing recorded this month', () => {
    const r = buildReminders([bella], [], MONTH, NOW);
    expect(r.some((x) => x.kind === 'missing-earnings')).toBe(true);
  });

  it('never chases archived, paused or agency records', () => {
    const ended = makeCreator({ id: 'e', name: 'Ended', status: 'ended', revenue_share: null });
    const paused = makeCreator({ id: 'p', name: 'Paused', status: 'paused', revenue_share: null });
    const agency = makeCreator({ id: 'ag', name: 'Agency', kind: 'agency', revenue_share: null });
    expect(buildReminders([ended, paused, agency], [], MONTH, NOW)).toEqual([]);
  });

  it('still chases money owed to a creator who has since left', () => {
    // She's gone, but you still owe her — that must not disappear.
    const ended = makeCreator({ id: 'e', name: 'Ended', status: 'ended', revenue_share: 50 });
    const r = buildReminders(
      [ended],
      [earning({ creator_id: 'e', month: '2026-05-01', gross: 400 })],
      MONTH,
      NOW,
    );
    expect(r.filter((x) => x.kind === 'unpaid')).toHaveLength(1);
  });

  it('puts money above housekeeping', () => {
    const r = buildReminders(
      [makeCreator({ id: 'b', name: 'Bella', revenue_share: 45, contract_status: 'none' })],
      [earning({ creator_id: 'b', month: MONTH, gross: 1000 })],
      MONTH,
      NOW,
    );
    expect(r[0].kind).toBe('unpaid');
  });
});
