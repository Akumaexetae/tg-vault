export interface BackupSettings {
  enabled: boolean;
  folder: string | null;
  everyDays: number;
  keep: number;
  lastAt: string | null;
}

export const DEFAULT_BACKUP: BackupSettings = {
  enabled: false,
  folder: null,
  everyDays: 7,
  keep: 10,
  lastAt: null,
};

const DAY_MS = 86_400_000;

/**
 * Whether a backup is due.
 *
 * A never-backed-up vault is always due — that's the case that matters most,
 * since it means the safety net has never once existed.
 */
export function isBackupDue(
  settings: BackupSettings,
  now: number = Date.now(),
): boolean {
  if (!settings.enabled || !settings.folder) return false;
  if (!settings.lastAt) return true;
  const last = new Date(settings.lastAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= settings.everyDays * DAY_MS;
}

/** Sortable, so the newest is always last alphabetically. */
export function autoBackupName(iso: string): string {
  return `tg-vault-${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}.json`;
}

export const AUTO_BACKUP_PATTERN = /^tg-vault-\d{4}-\d{2}-\d{2}-\d{4}\.json$/;

/**
 * Which files to delete to keep only the newest `keep`.
 *
 * Only ever returns files matching our own naming pattern — the backup folder
 * may be a normal folder of the user's, and deleting anything we didn't write
 * would be unforgivable.
 */
export function prunableBackups(files: string[], keep: number): string[] {
  const ours = files.filter((f) => AUTO_BACKUP_PATTERN.test(f)).sort();
  if (keep <= 0) return [];
  return ours.slice(0, Math.max(0, ours.length - keep));
}

/** Human summary for the settings screen. */
export function describeSchedule(settings: BackupSettings): string {
  if (!settings.enabled) return 'Off';
  if (!settings.folder) return 'No folder chosen';
  const every =
    settings.everyDays === 1 ? 'Every day' : `Every ${settings.everyDays} days`;
  const last = settings.lastAt
    ? `last ${new Date(settings.lastAt).toLocaleDateString()}`
    : 'never run';
  return `${every}, keeping ${settings.keep} — ${last}`;
}
