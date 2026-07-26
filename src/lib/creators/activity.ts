import type { Creator, CreatorInput } from '../types';

/**
 * Human-readable names of the fields that changed.
 *
 * Values are deliberately NOT returned. The activity feed is shared, exported
 * in backups, and the closest thing this app has to an audit log — an IBAN or
 * ID reference must never land in it (spec §5).
 */
const LABELS: Partial<Record<keyof CreatorInput, string>> = {
  name: 'stage name',
  color: 'colour',
  kind: 'type',
  status: 'status',
  legal_name: 'legal name',
  date_of_birth: 'date of birth',
  nationality: 'nationality',
  id_reference: 'ID reference',
  email: 'email',
  phone: 'phone',
  telegram: 'Telegram',
  timezone: 'timezone',
  revenue_share: 'revenue share',
  start_date: 'start date',
  contract_status: 'contract status',
  notice_period_days: 'notice period',
  minimum_guarantee: 'minimum guarantee',
  payout_method: 'payout method',
  payout_details: 'payout details',
  payout_currency: 'payout currency',
  payout_schedule: 'payout schedule',
  of_url: 'OnlyFans link',
  getmysocial_url: 'Getmysocial link',
  socials: 'socials',
  subscriber_count: 'subscriber count',
  subscriber_count_as_of: 'subscriber count date',
  drive_folder_url: 'Drive folder',
};

export function changedFieldNames(before: Creator, after: CreatorInput): string[] {
  const names: string[] = [];
  for (const key of Object.keys(LABELS) as (keyof CreatorInput)[]) {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) names.push(LABELS[key]!);
  }
  return names;
}
