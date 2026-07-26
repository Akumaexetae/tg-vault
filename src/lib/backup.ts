import type { Creator, VaultData } from './types';

export interface BackupFile {
  app: 'T&G Vault';
  version: 1;
  exported_at: string;
  data: VaultData;
}

/** Full plaintext snapshot — the vault has no encryption by design. */
export function buildBackup(data: VaultData, exportedAt: string): BackupFile {
  return { app: 'T&G Vault', version: 1, exported_at: exportedAt, data };
}

const csvCell = (value: unknown): string => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Spreadsheet-friendly view of the accounts (notes/activity omitted). */
export function buildCsv(data: VaultData): string {
  const creator = (id: string) =>
    data.creators.find((c: Creator) => c.id === id)?.name ?? '';
  const header = [
    'Service', 'Creator', 'Username', 'Password', '2FA secret',
    'URL', 'Proxy', 'Recovery', 'Notes', 'Updated',
  ];
  const rows = data.entries.map((e) =>
    [
      e.service_name, creator(e.creator_id), e.username, e.password,
      e.totp_secret ?? '', e.service_url, e.proxy ?? '',
      e.recovery ?? '', e.notes ?? '', e.updated_at,
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...rows].join('\r\n');
}

export const backupFilename = (iso: string, ext: 'json' | 'csv'): string =>
  `tg-vault-backup-${iso.slice(0, 10)}.${ext}`;
