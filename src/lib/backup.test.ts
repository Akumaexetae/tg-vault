import { describe, expect, it } from 'vitest';
import { backupFilename, buildBackup, buildCreatorsCsv, buildCsv } from './backup';
import { makeCreator } from './creators/fixtures';
import type { Entry, VaultData } from './types';

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e1',
  service_name: 'OnlyFans',
  service_key: 'onlyfans',
  service_url: 'https://onlyfans.com',
  creator_id: 'c1',
  username: 'bella@of.com',
  password: 'pw',
  totp_secret: null,
  recovery: null,
  custom_fields: [],
  notes: null,
  proxy: null,
  pinned: false,
  history: [],
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  updated_by: 'Tyler',
  ...over,
});

const data: VaultData = {
  creators: [
    makeCreator({
      legal_name: 'Isabella Moreau',
      payout_method: 'iban',
      payout_details: 'FR76 3000 6000 0112',
      payout_currency: 'EUR',
      contract_status: 'signed',
    }),
  ],
  entries: [entry({})],
  notes: [],
  documents: [],
  earnings: [],
  daily: [],
  cards: [],
  activity: [],
};

describe('buildBackup', () => {
  it('wraps the vault with app metadata', () => {
    const backup = buildBackup(data, '2026-07-26T10:00:00Z');
    expect(backup.app).toBe('T&G Vault');
    expect(backup.version).toBe(1);
    expect(backup.data.entries).toHaveLength(1);
  });

  it('includes documents and earnings so the snapshot stays complete', () => {
    const backup = buildBackup(data, '2026-07-26T10:00:00Z');
    expect(backup.data).toHaveProperty('documents');
    expect(backup.data).toHaveProperty('earnings');
  });
});

describe('buildCsv', () => {
  it('writes a header plus one row per entry, resolving creator names', () => {
    const lines = buildCsv(data).split('\r\n');
    expect(lines[0]).toContain('Service,Creator,Username,Password');
    expect(lines[1]).toContain('OnlyFans,Bella,bella@of.com,pw');
  });

  it('quotes cells containing commas or quotes', () => {
    const tricky = { ...data, entries: [entry({ notes: 'a,b "quoted"' })] };
    expect(buildCsv(tricky)).toContain('"a,b ""quoted"""');
  });
});

describe('buildCreatorsCsv', () => {
  it('lists creators with their commercial terms', () => {
    const lines = buildCreatorsCsv(data).split('\r\n');
    expect(lines[0]).toContain('Stage name,Legal name,Status,Share %');
    expect(lines[1]).toContain('Bella,Isabella Moreau,active,45');
  });

  it('never includes payout details', () => {
    expect(buildCreatorsCsv(data)).not.toContain('FR76');
  });
});

describe('backupFilename', () => {
  it('names files by export date', () => {
    expect(backupFilename('2026-07-26T10:00:00Z', 'json')).toBe(
      'tg-vault-backup-2026-07-26.json',
    );
  });
});
