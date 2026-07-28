import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKUP,
  autoBackupName,
  describeSchedule,
  isBackupDue,
  prunableBackups,
  type BackupSettings,
} from './autoBackup';

const settings = (over: Partial<BackupSettings> = {}): BackupSettings => ({
  ...DEFAULT_BACKUP,
  enabled: true,
  folder: 'C:/backups',
  ...over,
});

const NOW = new Date('2026-07-28T12:00:00Z').getTime();

describe('isBackupDue', () => {
  it('is false when disabled or without a folder', () => {
    expect(isBackupDue(settings({ enabled: false }), NOW)).toBe(false);
    expect(isBackupDue(settings({ folder: null }), NOW)).toBe(false);
  });

  it('is true when it has never run', () => {
    expect(isBackupDue(settings({ lastAt: null }), NOW)).toBe(true);
  });

  it('is true once the interval has passed', () => {
    expect(isBackupDue(settings({ lastAt: '2026-07-21T12:00:00Z' }), NOW)).toBe(true);
    expect(isBackupDue(settings({ lastAt: '2026-07-24T12:00:00Z' }), NOW)).toBe(false);
  });

  it('treats a corrupt timestamp as due rather than silently never backing up', () => {
    expect(isBackupDue(settings({ lastAt: 'nonsense' }), NOW)).toBe(true);
  });

  it('respects a custom interval', () => {
    const daily = settings({ everyDays: 1, lastAt: '2026-07-27T11:00:00Z' });
    expect(isBackupDue(daily, NOW)).toBe(true);
  });
});

describe('autoBackupName', () => {
  it('names files so they sort chronologically', () => {
    expect(autoBackupName('2026-07-28T09:05:00Z')).toBe('tg-vault-2026-07-28-0905.json');
    const a = autoBackupName('2026-07-28T09:05:00Z');
    const b = autoBackupName('2026-07-28T14:30:00Z');
    expect([b, a].sort()).toEqual([a, b]);
  });
});

describe('prunableBackups', () => {
  const files = [
    'tg-vault-2026-07-01-0900.json',
    'tg-vault-2026-07-08-0900.json',
    'tg-vault-2026-07-15-0900.json',
    'tg-vault-2026-07-22-0900.json',
  ];

  it('returns the oldest beyond the keep count', () => {
    expect(prunableBackups(files, 2)).toEqual([
      'tg-vault-2026-07-01-0900.json',
      'tg-vault-2026-07-08-0900.json',
    ]);
  });

  it('returns nothing when under the limit', () => {
    expect(prunableBackups(files, 10)).toEqual([]);
  });

  it('NEVER touches files it did not write', () => {
    const mixed = [
      ...files,
      'tax-return-2025.pdf',
      'holiday photo.jpg',
      'tg-vault-backup-2026-07-26.json', // the manual export's naming
      'important.json',
    ];
    const doomed = prunableBackups(mixed, 1);
    expect(doomed).toEqual([
      'tg-vault-2026-07-01-0900.json',
      'tg-vault-2026-07-08-0900.json',
      'tg-vault-2026-07-15-0900.json',
    ]);
    expect(doomed).not.toContain('tax-return-2025.pdf');
    expect(doomed).not.toContain('holiday photo.jpg');
    expect(doomed).not.toContain('important.json');
    expect(doomed).not.toContain('tg-vault-backup-2026-07-26.json');
  });

  it('deletes nothing when keep is zero or negative', () => {
    expect(prunableBackups(files, 0)).toEqual([]);
    expect(prunableBackups(files, -1)).toEqual([]);
  });
});

describe('describeSchedule', () => {
  it('describes the current setup in words', () => {
    expect(describeSchedule(settings({ enabled: false }))).toBe('Off');
    expect(describeSchedule(settings({ folder: null }))).toBe('No folder chosen');
    expect(describeSchedule(settings({ lastAt: null }))).toMatch(/never run/);
    expect(describeSchedule(settings({ everyDays: 1, lastAt: null }))).toMatch(
      /^Every day/,
    );
  });
});
