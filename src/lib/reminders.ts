import { splitEarning } from './creators/earnings';
import type { Creator, CreatorEarning } from './types';

export type ReminderKind =
  | 'unpaid'
  | 'unsigned-contract'
  | 'no-share'
  | 'stale-subscribers'
  | 'missing-earnings';

export interface Reminder {
  kind: ReminderKind;
  creatorId: string;
  creatorName: string;
  message: string;
  /** Higher sorts first — money owed outranks housekeeping. */
  weight: number;
}

const DAY_MS = 86_400_000;
const STALE_SUBSCRIBER_DAYS = 90;

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

const daysBetween = (from: string, now: number): number =>
  Math.floor((now - new Date(from).getTime()) / DAY_MS);

/**
 * Things worth acting on, built only from data already stored.
 *
 * Deliberately excludes archived, paused and agency rows — chasing a creator
 * who left is noise, and the point of this list is that everything on it is
 * actionable.
 */
export function buildReminders(
  creators: Creator[],
  earnings: CreatorEarning[],
  currentMonth: string,
  now: number = Date.now(),
): Reminder[] {
  const active = creators.filter(
    (c) => c.kind === 'creator' && (c.status === 'active' || c.status === 'onboarding'),
  );
  const byId = new Map(creators.map((c) => [c.id, c]));
  const reminders: Reminder[] = [];

  // Money owed out, oldest first — the one that actually costs you goodwill.
  for (const e of earnings) {
    if (e.paid_at) continue;
    const creator = byId.get(e.creator_id);
    if (!creator || creator.kind !== 'creator') continue;
    const split = splitEarning(e.gross, creator.revenue_share);
    if (split.creator <= 0) continue;
    const age = daysBetween(e.month, now);
    reminders.push({
      kind: 'unpaid',
      creatorId: creator.id,
      creatorName: creator.name,
      message: `${money(split.creator, e.currency || 'EUR')} owed to ${creator.name} for ${e.month.slice(0, 7)}`,
      weight: 100 + Math.min(age, 365),
    });
  }

  for (const c of active) {
    if (c.contract_status !== 'signed') {
      reminders.push({
        kind: 'unsigned-contract',
        creatorId: c.id,
        creatorName: c.name,
        message:
          c.contract_status === 'sent'
            ? `${c.name}'s contract is sent but not signed`
            : `${c.name} has no contract on file`,
        weight: 80,
      });
    }

    if (c.revenue_share === null) {
      reminders.push({
        kind: 'no-share',
        creatorId: c.id,
        creatorName: c.name,
        message: `${c.name} has no revenue share set — her splits read as zero`,
        weight: 90,
      });
    }

    if (c.subscriber_count !== null && c.subscriber_count_as_of) {
      const age = daysBetween(c.subscriber_count_as_of, now);
      if (age > STALE_SUBSCRIBER_DAYS) {
        reminders.push({
          kind: 'stale-subscribers',
          creatorId: c.id,
          creatorName: c.name,
          message: `${c.name}'s subscriber count is ${age} days old`,
          weight: 20,
        });
      }
    }
  }

  // Nothing recorded for the current month.
  const recorded = new Set(
    earnings
      .filter((e) => e.month.slice(0, 7) === currentMonth.slice(0, 7))
      .map((e) => e.creator_id),
  );
  for (const c of active) {
    if (!recorded.has(c.id)) {
      reminders.push({
        kind: 'missing-earnings',
        creatorId: c.id,
        creatorName: c.name,
        message: `No earnings recorded for ${c.name} this month`,
        weight: 60,
      });
    }
  }

  return reminders.sort(
    (a, b) => b.weight - a.weight || a.creatorName.localeCompare(b.creatorName),
  );
}
