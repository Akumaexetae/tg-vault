import { instagramHandle } from './instagram';

/**
 * Instagram numbers come from the CRM, which already owns the hard part.
 *
 * Bundle snapshots each account nightly, and the two channels count
 * differently — Instagram reports a rolling window that declines on its own,
 * Threads counts for life. The CRM resolves that before we see it, so this
 * module only matches rows to numbers and must not do arithmetic on them.
 */

/** The subset of the CRM's payload the Vault reads. */
export interface CrmAccount {
  handle: string | null;
  platform: string;
  /** Instagram's rolling-window figure. The meaningful number for this channel. */
  impressions: number | null;
  /** Plays. Much smaller than impressions, and not what the roster is judged on. */
  views: number | null;
  measuredAt: string | null;
}

export interface CrmAnalytics {
  accounts: CrmAccount[];
}

export interface AccountViews {
  impressions: number | null;
  views: number | null;
  measuredAt: string | null;
}

/**
 * The number to show for an account.
 *
 * Instagram counts on a ROLLING window, so the CRM leaves views7d and
 * viewsPerDay null for it — a sliding window cannot be differenced into a
 * daily figure. Its impressions field is already a period figure and is the
 * one the CRM's own screens rank on. Using views7d here showed a dash on every
 * Instagram row, which read as "no data" rather than "wrong field".
 */
export function primaryCount(account: AccountViews | null): number | null {
  if (!account) return null;
  return account.impressions ?? account.views ?? null;
}

/**
 * Where the CRM lives. Shared so Settings and the background poll cannot
 * disagree — they did, and the poll silently never ran because its own default
 * was an empty string.
 */
export const DEFAULT_CRM_URL = 'https://crm.tgagencypro.com';

/** A snapshot older than this is stale — Bundle measures nightly. */
export const STALE_AFTER_DAYS = 2;

export function isStale(measuredAt: string | null, now: number = Date.now()): boolean {
  if (!measuredAt) return true;
  const taken = new Date(measuredAt).getTime();
  if (Number.isNaN(taken)) return true;
  return now - taken > STALE_AFTER_DAYS * 86_400_000;
}

/**
 * Index the CRM's Instagram accounts by handle.
 *
 * Handles are case-insensitive on Instagram and the vault stores whatever was
 * typed — "Permesa.lola" against the CRM's "permesa.lola" — so both sides are
 * lowercased or nothing matches.
 */
export function indexByHandle(
  payload: CrmAnalytics | { data?: CrmAnalytics } | null,
): Map<string, AccountViews> {
  const index = new Map<string, AccountViews>();
  // Accepts the CRM's { ok, data } envelope as well as the bare report, so a
  // change at either end cannot silently produce an empty list again.
  const report =
    payload && 'accounts' in payload ? payload : ((payload as { data?: CrmAnalytics })?.data ?? null);
  for (const account of report?.accounts ?? []) {
    if (account.platform !== 'INSTAGRAM' || !account.handle) continue;
    index.set(account.handle.trim().toLowerCase(), {
      impressions: account.impressions,
      views: account.views,
      measuredAt: account.measuredAt,
    });
  }
  return index;
}

/** Numbers for one vault entry, or null when the CRM has none for it. */
export function viewsFor(
  username: string,
  index: Map<string, AccountViews>,
): AccountViews | null {
  const handle = instagramHandle(username);
  if (!handle) return null;
  return index.get(handle.toLowerCase()) ?? null;
}

/** "12.4k", "903", "1.2M" — a view count that fits a table cell. */
export function compactViews(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
  }
  const m = value / 1_000_000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}
