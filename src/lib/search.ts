import type { Creator, Entry } from './types';

/** Case-insensitive match on service, creator name, username, or notes. */
export function matchesQuery(
  entry: Entry,
  creatorName: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [entry.service_name, creatorName, entry.username, entry.notes ?? '']
    .some((field) => field.toLowerCase().includes(q));
}

export function filterEntries(
  entries: Entry[],
  creators: Creator[],
  query: string,
): Entry[] {
  const nameById = new Map(creators.map((c) => [c.id, c.name]));
  return entries.filter((e) =>
    matchesQuery(e, nameById.get(e.creator_id) ?? '', query),
  );
}

/**
 * Creator match for global search.
 *
 * Payout details and ID references are deliberately excluded — a bank account
 * should not surface from a stray keystroke (spec §5).
 */
export function matchesCreator(creator: Creator, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    creator.name,
    creator.legal_name ?? '',
    creator.email ?? '',
    creator.telegram ?? '',
  ].some((field) => field.toLowerCase().includes(q));
}

/** "Bella's OnlyFans" — used for activity log labels. */
export function entryLabel(
  entry: Pick<Entry, 'service_name' | 'creator_id' | 'username'>,
  creators: Creator[],
): string {
  const creator = creators.find((c) => c.id === entry.creator_id);
  const owner = creator ? `${creator.name}'s` : '';
  return `${owner} ${entry.service_name}`.trim() + ` (${entry.username})`;
}
