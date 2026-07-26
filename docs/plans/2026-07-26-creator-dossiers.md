# Creator Dossiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `../specs/2026-07-26-creator-dossiers-design.md`.

**Goal:** Turn a creator from a coloured tag into a full dossier — identity, commercial terms, payout, platform links, documents and monthly earnings — with two switchable layouts.

**Architecture:** Extends the existing Electron + React + Supabase app. New pure logic goes in `src/lib/creators/*` with unit tests; dossier UI in `src/views/dossier/*` sharing one set of tile components across both layouts. No new dependencies.

**Tech Stack:** Existing — React 19, TypeScript, `@supabase/supabase-js`, Vitest. No additions.

## Global Constraints

- Project root: `C:\Users\Tyler\Desktop\TG Vault` (repo `Akumaexetae/tg-vault`, public — **never commit credentials**).
- Both dossier layouts render **identical tile components**; only hero shape and grid template differ. Do not fork the tiles.
- Activity logging records changed **field names, never values**. An IBAN must never reach the `activity` table.
- Payout details are excluded from search.
- Uploads capped at **10 MB**; bulk content belongs in Drive.
- Earnings splits are **derived at read time** from `creators.revenue_share`, never stored.
- `entries.creator_id` becomes `on delete restrict` — deleting a creator must never destroy credentials.
- Theme: existing bright white→`#00AFF0` gradient. Reuse existing CSS custom properties and `.card` / `.pill` / `.btn` classes.
- All copy in English.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/types.ts` (modify) | `Creator` extended; new `CreatorDocument`, `CreatorEarning`, `CreatorStatus`, `CreatorKind`, `PayoutMethod` |
| `src/lib/creators/validation.ts` (new) | Revenue-share bounds, payout validation, document url/path rule, upload size guard, agency field visibility |
| `src/lib/creators/earnings.ts` (new) | Split derivation, month keys, 6-month series for the chart |
| `src/lib/creators/sort.ts` (new) | Status ordering for the sidebar |
| `src/lib/creators/activity.ts` (new) | Diff two creators → changed field **names** for the activity feed |
| `src/lib/queries.ts` (modify) | Creator update, document CRUD, earnings upsert, deletion guard |
| `src/lib/backup.ts` (modify) | Include dossier fields, documents, earnings |
| `src/lib/search.ts` (modify) | Match legal name / email / telegram; never payout details |
| `src/views/dossier/DossierView.tsx` (new) | Route container; picks layout, owns drill-down state |
| `src/views/dossier/DossierHero.tsx` (new) | Hero, both shapes via a `variant` prop |
| `src/views/dossier/tiles/*.tsx` (new) | `EarningsTile`, `LoginsTile`, `PayoutTile`, `LinksTile` — shared by both layouts |
| `src/views/dossier/CreatorModal.tsx` (new) | Sectioned add/edit form |
| `src/views/dossier/DocumentsView.tsx` (new) | Document list, add link / upload |
| `supabase/migration-003.sql` (new) | Columns, tables, bucket, FK change |

---

### Task 1: Types and validation

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/creators/validation.ts`
- Test: `src/lib/creators/validation.test.ts`

**Interfaces:**
- Produces: `CreatorStatus`, `CreatorKind`, `PayoutMethod`, extended `Creator`, `CreatorDocument`, `CreatorEarning`; `validateRevenueShare(value: number | null): string | null`, `validatePayout(method: PayoutMethod | null, details: string | null): string | null`, `validateDocument(doc: {url?: string|null; storagePath?: string|null; sizeBytes?: number|null}): string | null`, `MAX_UPLOAD_BYTES`, `showsPersonalFields(kind: CreatorKind): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/creators/validation.test.ts
import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  showsPersonalFields,
  validateDocument,
  validatePayout,
  validateRevenueShare,
} from './validation';

describe('validateRevenueShare', () => {
  it('accepts 0 to 100 inclusive', () => {
    expect(validateRevenueShare(0)).toBeNull();
    expect(validateRevenueShare(45)).toBeNull();
    expect(validateRevenueShare(100)).toBeNull();
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(validateRevenueShare(-1)).toMatch(/between 0 and 100/);
    expect(validateRevenueShare(101)).toMatch(/between 0 and 100/);
    expect(validateRevenueShare(Number.NaN)).toMatch(/number/);
  });

  it('allows an unset share', () => {
    expect(validateRevenueShare(null)).toBeNull();
  });
});

describe('validatePayout', () => {
  it('requires details once a method is chosen', () => {
    expect(validatePayout('iban', '')).toMatch(/details/);
    expect(validatePayout('iban', 'FR76 3000 6000 0112 3456 7890 189')).toBeNull();
  });

  it('is satisfied when no method is set', () => {
    expect(validatePayout(null, '')).toBeNull();
  });
});

describe('validateDocument', () => {
  it('requires exactly one of url or storagePath', () => {
    expect(validateDocument({})).toMatch(/link or a file/);
    expect(validateDocument({ url: 'https://x', storagePath: 'a/b' })).toMatch(/not both/);
    expect(validateDocument({ url: 'https://drive.google.com/x' })).toBeNull();
  });

  it('rejects uploads over the cap but allows the boundary', () => {
    expect(validateDocument({ storagePath: 'a/b', sizeBytes: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateDocument({ storagePath: 'a/b', sizeBytes: MAX_UPLOAD_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe('showsPersonalFields', () => {
  it('hides personal fields for the agency row', () => {
    expect(showsPersonalFields('creator')).toBe(true);
    expect(showsPersonalFields('agency')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL — cannot resolve `./validation`

- [ ] **Step 3: Add the types**

Append to `src/lib/types.ts`:

```ts
export type CreatorKind = 'creator' | 'agency';
export type CreatorStatus = 'prospect' | 'onboarding' | 'active' | 'paused' | 'ended';
export type PayoutMethod = 'iban' | 'paypal' | 'wise' | 'crypto' | 'other';
export type ContractStatus = 'none' | 'sent' | 'signed';
export type PayoutSchedule = 'weekly' | 'monthly';

export interface SocialLink {
  label: string;
  url: string;
}

export interface CreatorDocument {
  id: string;
  creator_id: string;
  label: string;
  kind: 'contract' | 'id' | 'other';
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_by: User;
}

export interface CreatorEarning {
  id: string;
  creator_id: string;
  month: string; // ISO date, first of month
  gross: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_by: User;
}
```

Replace the existing `Creator` interface with:

```ts
export interface Creator {
  id: string;
  name: string;
  color: string;
  kind: CreatorKind;
  status: CreatorStatus;
  legal_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  id_reference: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  timezone: string | null;
  revenue_share: number | null;
  start_date: string | null;
  contract_status: ContractStatus;
  notice_period_days: number | null;
  minimum_guarantee: number | null;
  payout_method: PayoutMethod | null;
  payout_details: string | null;
  payout_currency: string | null;
  payout_schedule: PayoutSchedule | null;
  of_url: string | null;
  getmysocial_url: string | null;
  socials: SocialLink[];
  subscriber_count: number | null;
  subscriber_count_as_of: string | null;
  drive_folder_url: string | null;
  created_at: string;
  updated_at: string;
  updated_by: User;
}

export type CreatorInput = Omit<Creator, 'id' | 'created_at' | 'updated_at' | 'updated_by'>;
```

Extend `VaultData`:

```ts
export interface VaultData {
  creators: Creator[];
  entries: Entry[];
  notes: SecureNote[];
  documents: CreatorDocument[];
  earnings: CreatorEarning[];
  activity: Activity[];
}
```

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/creators/validation.ts
import type { CreatorKind, PayoutMethod } from '../types';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateRevenueShare(value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'Revenue share must be a number.';
  if (value < 0 || value > 100) return 'Revenue share must be between 0 and 100.';
  return null;
}

export function validatePayout(
  method: PayoutMethod | null,
  details: string | null,
): string | null {
  if (!method) return null;
  if (!details || !details.trim()) return 'Add the payout details for this method.';
  return null;
}

export function validateDocument(doc: {
  url?: string | null;
  storagePath?: string | null;
  sizeBytes?: number | null;
}): string | null {
  const hasUrl = !!doc.url?.trim();
  const hasFile = !!doc.storagePath?.trim();
  if (hasUrl && hasFile) return 'A document is a link or a file, not both.';
  if (!hasUrl && !hasFile) return 'Add a link or a file.';
  if (hasFile && (doc.sizeBytes ?? 0) > MAX_UPLOAD_BYTES) {
    return 'Files over 10 MB belong in Drive — link them instead.';
  }
  return null;
}

/** The Agency row has no birthday, contract or bank account. */
export function showsPersonalFields(kind: CreatorKind): boolean {
  return kind === 'creator';
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- validation` → PASS. Then `npm run typecheck`.
Typecheck will fail in files reading `VaultData.documents`/`earnings` — that is expected and fixed in Task 3. If it fails anywhere else, fix it now.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/creators/
git commit -m "feat: creator dossier types and validation"
```

---

### Task 2: Earnings derivation, sorting, activity diffing

**Files:**
- Create: `src/lib/creators/earnings.ts`, `src/lib/creators/sort.ts`, `src/lib/creators/activity.ts`
- Test: `src/lib/creators/earnings.test.ts`, `src/lib/creators/sort.test.ts`, `src/lib/creators/activity.test.ts`

**Interfaces:**
- Consumes: `Creator`, `CreatorEarning`, `CreatorStatus` from Task 1
- Produces: `splitEarning(gross: number, sharePercent: number | null): {agency: number; creator: number}`, `monthKey(iso: string): string`, `lastSixMonths(earnings: CreatorEarning[], now?: Date): {month: string; gross: number}[]`, `sortCreators(creators: Creator[]): Creator[]`, `changedFieldNames(before: Creator, after: CreatorInput): string[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/creators/earnings.test.ts
import { describe, expect, it } from 'vitest';
import { lastSixMonths, monthKey, splitEarning } from './earnings';
import type { CreatorEarning } from '../types';

const earning = (month: string, gross: number): CreatorEarning => ({
  id: month,
  creator_id: 'c1',
  month,
  gross,
  currency: 'EUR',
  notes: null,
  created_at: month,
  updated_by: 'Tyler',
});

describe('splitEarning', () => {
  it('splits gross by the agency share', () => {
    expect(splitEarning(1000, 45)).toEqual({ agency: 450, creator: 550 });
  });

  it('rounds to cents without losing a penny', () => {
    const { agency, creator } = splitEarning(100.01, 33);
    expect(agency + creator).toBeCloseTo(100.01, 2);
  });

  it('treats an unset share as nothing owed to the agency', () => {
    expect(splitEarning(500, null)).toEqual({ agency: 0, creator: 500 });
  });
});

describe('monthKey', () => {
  it('normalises any date to the first of its month', () => {
    expect(monthKey('2026-07-26T12:00:00Z')).toBe('2026-07-01');
  });
});

describe('lastSixMonths', () => {
  it('returns six slots ending with the current month, zero-filling gaps', () => {
    const series = lastSixMonths(
      [earning('2026-07-01', 900), earning('2026-05-01', 400)],
      new Date('2026-07-15T00:00:00Z'),
    );
    expect(series).toHaveLength(6);
    expect(series[5]).toEqual({ month: '2026-07-01', gross: 900 });
    expect(series[3]).toEqual({ month: '2026-05-01', gross: 400 });
    expect(series[4]).toEqual({ month: '2026-06-01', gross: 0 });
  });
});
```

```ts
// src/lib/creators/sort.test.ts
import { describe, expect, it } from 'vitest';
import { sortCreators } from './sort';
import type { Creator, CreatorStatus } from '../types';

const creator = (name: string, status: CreatorStatus): Creator =>
  ({ id: name, name, color: '#000', kind: 'creator', status } as Creator);

describe('sortCreators', () => {
  it('orders active first, then by status, then by name', () => {
    const sorted = sortCreators([
      creator('Zara', 'active'),
      creator('Lena', 'ended'),
      creator('Mia', 'paused'),
      creator('Bella', 'active'),
      creator('Nina', 'prospect'),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(['Bella', 'Zara', 'Nina', 'Mia', 'Lena']);
  });
});
```

```ts
// src/lib/creators/activity.test.ts
import { describe, expect, it } from 'vitest';
import { changedFieldNames } from './activity';
import type { Creator, CreatorInput } from '../types';

const base = {
  name: 'Bella', color: '#f0a', kind: 'creator', status: 'active',
  legal_name: 'Isabella M.', date_of_birth: null, nationality: null,
  id_reference: null, email: null, phone: null, telegram: null, timezone: null,
  revenue_share: 45, start_date: null, contract_status: 'signed',
  notice_period_days: null, minimum_guarantee: null,
  payout_method: 'iban', payout_details: 'FR76 3000 1111',
  payout_currency: 'EUR', payout_schedule: 'monthly',
  of_url: null, getmysocial_url: null, socials: [], subscriber_count: null,
  subscriber_count_as_of: null, drive_folder_url: null,
} as CreatorInput;

const before = { ...base, id: 'c1', created_at: '', updated_at: '', updated_by: 'Tyler' } as Creator;

describe('changedFieldNames', () => {
  it('names the fields that changed', () => {
    const after = { ...base, revenue_share: 30 };
    expect(changedFieldNames(before, after)).toEqual(['revenue share']);
  });

  it('NEVER includes the value of a sensitive field', () => {
    const after = { ...base, payout_details: 'FR76 9999 SECRET' };
    const changed = changedFieldNames(before, after);
    expect(changed).toEqual(['payout details']);
    expect(changed.join(' ')).not.toContain('9999');
    expect(changed.join(' ')).not.toContain('SECRET');
  });

  it('returns an empty list when nothing changed', () => {
    expect(changedFieldNames(before, { ...base })).toEqual([]);
  });

  it('detects changes inside the socials list', () => {
    const after = { ...base, socials: [{ label: 'X', url: 'https://x.com/bella' }] };
    expect(changedFieldNames(before, after)).toEqual(['socials']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- creators`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

```ts
// src/lib/creators/earnings.ts
import type { CreatorEarning } from '../types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Agency cut and creator payout, derived — never stored (see spec §4). */
export function splitEarning(
  gross: number,
  sharePercent: number | null,
): { agency: number; creator: number } {
  const share = sharePercent ?? 0;
  const agency = round2((gross * share) / 100);
  // Creator takes the remainder so the two always add back to gross.
  return { agency, creator: round2(gross - agency) };
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-01`;
}

/** Six month slots ending with the current month, zero-filled. */
export function lastSixMonths(
  earnings: CreatorEarning[],
  now: Date = new Date(),
): { month: string; gross: number }[] {
  const byMonth = new Map(earnings.map((e) => [monthKey(e.month), e.gross]));
  const slots: { month: string; gross: number }[] = [];
  for (let back = 5; back >= 0; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = monthKey(d.toISOString());
    slots.push({ month: key, gross: byMonth.get(key) ?? 0 });
  }
  return slots;
}
```

```ts
// src/lib/creators/sort.ts
import type { Creator, CreatorStatus } from '../types';

const RANK: Record<CreatorStatus, number> = {
  active: 0,
  onboarding: 1,
  prospect: 2,
  paused: 3,
  ended: 4,
};

export function sortCreators(creators: Creator[]): Creator[] {
  return [...creators].sort((a, b) => {
    const rank = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
    return rank !== 0 ? rank : a.name.localeCompare(b.name);
  });
}
```

```ts
// src/lib/creators/activity.ts
import type { Creator, CreatorInput } from '../types';

/**
 * Human-readable names of the fields that changed.
 *
 * Values are deliberately NOT returned: the activity feed is shared and
 * exported, and an IBAN or ID reference must never land in it (spec §5).
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- creators` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/creators/
git commit -m "feat: earnings derivation, creator sorting, activity field diffing"
```

---

### Task 3: Migration and data layer

**Files:**
- Create: `supabase/migration-003.sql`
- Modify: `src/lib/queries.ts`, `src/hooks/useVault.ts`

**Interfaces:**
- Consumes: `changedFieldNames` (Task 2), types (Task 1)
- Produces: `updateCreator(before: Creator, input: CreatorInput, who: User): Promise<void>`, `createCreatorFull(input: CreatorInput, who: User): Promise<Creator>`, `deleteCreator(id: string, who: User, name: string): Promise<void>`, `canDeleteCreator(id: string, data: VaultData): string | null`, `saveDocument(doc, who): Promise<void>`, `deleteDocument(id, who, label): Promise<void>`, `saveEarning(creatorId, month, gross, currency, who): Promise<void>`, `uploadDocumentFile(file: File, creatorId: string): Promise<string>`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migration-003.sql — creator dossiers. Run once; safe to re-run.

alter table creators add column if not exists kind text not null default 'creator';
alter table creators add column if not exists status text not null default 'active';
alter table creators add column if not exists legal_name text;
alter table creators add column if not exists date_of_birth date;
alter table creators add column if not exists nationality text;
alter table creators add column if not exists id_reference text;
alter table creators add column if not exists email text;
alter table creators add column if not exists phone text;
alter table creators add column if not exists telegram text;
alter table creators add column if not exists timezone text;
alter table creators add column if not exists revenue_share numeric;
alter table creators add column if not exists start_date date;
alter table creators add column if not exists contract_status text not null default 'none';
alter table creators add column if not exists notice_period_days integer;
alter table creators add column if not exists minimum_guarantee numeric;
alter table creators add column if not exists payout_method text;
alter table creators add column if not exists payout_details text;
alter table creators add column if not exists payout_currency text;
alter table creators add column if not exists payout_schedule text;
alter table creators add column if not exists of_url text;
alter table creators add column if not exists getmysocial_url text;
alter table creators add column if not exists socials jsonb not null default '[]';
alter table creators add column if not exists subscriber_count integer;
alter table creators add column if not exists subscriber_count_as_of date;
alter table creators add column if not exists drive_folder_url text;
alter table creators add column if not exists created_at timestamptz not null default now();
alter table creators add column if not exists updated_at timestamptz not null default now();
alter table creators add column if not exists updated_by text not null default 'Tyler';

update creators set kind = 'agency' where name = 'Agency' and kind = 'creator';

create table if not exists creator_documents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete restrict,
  label text not null,
  kind text not null default 'other',
  url text,
  storage_path text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_by text not null,
  constraint document_link_or_file check (
    (url is not null and storage_path is null) or
    (url is null and storage_path is not null)
  )
);

create table if not exists creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete restrict,
  month date not null,
  gross numeric not null,
  currency text not null default 'EUR',
  notes text,
  created_at timestamptz not null default now(),
  updated_by text not null,
  unique (creator_id, month)
);

-- Deleting a creator must never destroy her credentials (spec §4).
alter table entries drop constraint if exists entries_creator_id_fkey;
alter table entries add constraint entries_creator_id_fkey
  foreign key (creator_id) references creators(id) on delete restrict;

alter table creator_documents disable row level security;
alter table creator_earnings disable row level security;
drop policy if exists "vault_all" on creator_documents;
drop policy if exists "vault_all" on creator_earnings;
create policy "vault_all" on creator_documents for all using (true) with check (true);
create policy "vault_all" on creator_earnings for all using (true) with check (true);

alter publication supabase_realtime add table creator_documents;
alter publication supabase_realtime add table creator_earnings;

insert into storage.buckets (id, name, public, file_size_limit)
  values ('documents', 'documents', false, 10485760)
  on conflict (id) do update set file_size_limit = 10485760;

drop policy if exists "documents_all" on storage.objects;
create policy "documents_all" on storage.objects
  for all using (bucket_id = 'documents') with check (bucket_id = 'documents');
```

- [ ] **Step 2: Run the migration**

Paste into the Supabase SQL editor and Run. Expected: "Success. No rows returned."
Verify: `select kind, status from creators;` returns `agency/active` for the Agency row.

- [ ] **Step 3: Extend fetchAll and add the write functions**

In `src/lib/queries.ts`, add `creator_documents` and `creator_earnings` to the `Promise.all` in `fetchAll`, returning them as `documents` and `earnings` on `VaultData`. Then add:

```ts
export async function createCreatorFull(
  input: CreatorInput,
  who: User,
): Promise<Creator> {
  const { data, error } = await getClient()
    .from('creators')
    .insert({ ...input, updated_by: who })
    .select()
    .single();
  if (error) throw error;
  await logActivity(who, 'created', `creator ${input.name}`);
  return data as Creator;
}

export async function updateCreator(
  before: Creator,
  input: CreatorInput,
  who: User,
): Promise<void> {
  const { error } = await getClient()
    .from('creators')
    .update({ ...input, updated_by: who, updated_at: new Date().toISOString() })
    .eq('id', before.id);
  if (error) throw error;
  const fields = changedFieldNames(before, input);
  if (fields.length > 0) {
    // Field names only — values must never reach the activity feed.
    await logActivity(who, 'updated', `${input.name}'s ${fields.join(', ')}`);
  }
}

/** Returns a reason the creator can't be deleted, or null if she can. */
export function canDeleteCreator(id: string, data: VaultData): string | null {
  const logins = data.entries.filter((e) => e.creator_id === id).length;
  const docs = data.documents.filter((d) => d.creator_id === id).length;
  const months = data.earnings.filter((e) => e.creator_id === id).length;
  const held = [
    logins && `${logins} login${logins === 1 ? '' : 's'}`,
    docs && `${docs} document${docs === 1 ? '' : 's'}`,
    months && `${months} month${months === 1 ? '' : 's'} of earnings`,
  ].filter(Boolean);
  if (held.length === 0) return null;
  return `Still holds ${held.join(', ')}. Archive instead to keep the history.`;
}

export async function deleteCreator(id: string, who: User, name: string): Promise<void> {
  const { error } = await getClient().from('creators').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', `creator ${name}`);
}

export async function uploadDocumentFile(file: File, creatorId: string): Promise<string> {
  const path = `${creatorId}/${Date.now()}-${file.name}`;
  const { error } = await getClient().storage.from('documents').upload(path, file);
  if (error) throw error;
  return path;
}

export async function saveDocument(
  doc: {
    creator_id: string;
    label: string;
    kind: CreatorDocument['kind'];
    url: string | null;
    storage_path: string | null;
    size_bytes: number | null;
  },
  who: User,
): Promise<void> {
  const { error } = await getClient()
    .from('creator_documents')
    .insert({ ...doc, updated_by: who });
  if (error) throw error;
  await logActivity(who, 'created', `document “${doc.label}”`);
}

export async function deleteDocument(id: string, who: User, label: string): Promise<void> {
  const { error } = await getClient().from('creator_documents').delete().eq('id', id);
  if (error) throw error;
  await logActivity(who, 'deleted', `document “${label}”`);
}

export async function saveEarning(
  creatorId: string,
  month: string,
  gross: number,
  currency: string,
  who: User,
): Promise<void> {
  const { error } = await getClient()
    .from('creator_earnings')
    .upsert(
      { creator_id: creatorId, month, gross, currency, updated_by: who },
      { onConflict: 'creator_id,month' },
    );
  if (error) throw error;
  await logActivity(who, 'updated', `earnings for ${month.slice(0, 7)}`);
}
```

Import `changedFieldNames` from `./creators/activity` and the new types at the top of the file.

- [ ] **Step 4: Subscribe to the new tables**

In `src/hooks/useVault.ts`, add two `.on('postgres_changes', ...)` lines to the channel for `creator_documents` and `creator_earnings`, matching the existing ones.

- [ ] **Step 5: Verify**

Run: `npm run typecheck` → clean. `npm test` → all previous tests still pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migration-003.sql src/lib/queries.ts src/hooks/useVault.ts
git commit -m "feat: dossier migration, creator/document/earnings queries, deletion guard"
```

---

### Task 4: Backup and search coverage

**Files:**
- Modify: `src/lib/backup.ts`, `src/lib/search.ts`
- Test: `src/lib/backup.test.ts`, `src/lib/search.test.ts`

**Interfaces:**
- Consumes: extended `VaultData` (Task 1)
- Produces: `buildCreatorsCsv(data: VaultData): string`; `matchesQuery` extended to creator fields

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/backup.test.ts` (and update the existing fixture to include `documents: []`, `earnings: []`):

```ts
describe('buildCreatorsCsv', () => {
  it('lists creators with their commercial terms', () => {
    const csv = buildCreatorsCsv(data);
    expect(csv.split('\r\n')[0]).toContain('Stage name,Legal name,Status,Share %');
    expect(csv).toContain('Bella');
  });

  it('never includes payout details', () => {
    expect(buildCreatorsCsv(data)).not.toContain('FR76');
  });
});

describe('buildBackup', () => {
  it('includes documents and earnings so the snapshot is complete', () => {
    const backup = buildBackup(data, '2026-07-26T10:00:00Z');
    expect(backup.data).toHaveProperty('documents');
    expect(backup.data).toHaveProperty('earnings');
  });
});
```

Add to `src/lib/search.test.ts`:

```ts
describe('matchesQuery — creator fields', () => {
  it('matches a creator legal name, email and telegram', () => {
    const creator = {
      ...creators[0],
      legal_name: 'Isabella Moreau',
      email: 'bella@mail.com',
      telegram: '@bella_x',
      payout_details: 'FR76 3000 SECRET',
    } as Creator;
    expect(matchesCreator(creator, 'moreau')).toBe(true);
    expect(matchesCreator(creator, 'bella@mail')).toBe(true);
    expect(matchesCreator(creator, '@bella_x')).toBe(true);
  });

  it('never matches payout details', () => {
    const creator = { ...creators[0], payout_details: 'FR76 3000 SECRET' } as Creator;
    expect(matchesCreator(creator, 'SECRET')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- backup search`
Expected: FAIL — `buildCreatorsCsv` and `matchesCreator` not exported

- [ ] **Step 3: Implement**

In `src/lib/backup.ts`, add:

```ts
/**
 * Creator sheet for the CSV export. Payout details are deliberately omitted —
 * a spreadsheet in Downloads is the wrong home for bank details (spec §6).
 */
export function buildCreatorsCsv(data: VaultData): string {
  const header = [
    'Stage name', 'Legal name', 'Status', 'Share %',
    'Contract', 'Payout method', 'Currency', 'Start date',
  ];
  const rows = data.creators.map((c) =>
    [
      c.name, c.legal_name ?? '', c.status, c.revenue_share ?? '',
      c.contract_status, c.payout_method ?? '', c.payout_currency ?? '', c.start_date ?? '',
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...rows].join('\r\n');
}
```

`buildBackup` already spreads the whole `VaultData`, so documents and earnings are included once Task 1's type change lands — the test asserts it stays that way.

In `src/lib/search.ts`, add:

```ts
/** Creator match for global search. Payout details are excluded by design. */
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
```

- [ ] **Step 4: Run tests** → PASS. Then wire the CSV export in `src/App.tsx` `handleExport` to append `buildCreatorsCsv(data)` under a blank line after the accounts rows.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup.ts src/lib/search.ts src/lib/backup.test.ts src/lib/search.test.ts src/App.tsx
git commit -m "feat: include dossier data in backups, extend search to creator fields"
```

---

### Task 5: Dossier tiles and hero

**Files:**
- Create: `src/views/dossier/DossierHero.tsx`, `src/views/dossier/tiles/EarningsTile.tsx`, `LoginsTile.tsx`, `PayoutTile.tsx`, `LinksTile.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `lastSixMonths`, `splitEarning` (Task 2), types (Task 1)
- Produces: `<DossierHero creator variant="wide" | "tall" owed={number} />`, `<EarningsTile earnings creator onRecord />`, `<LoginsTile entries onOpen />`, `<PayoutTile creator />`, `<LinksTile creator documents />`

- [ ] **Step 1: Build the hero**

```tsx
// src/views/dossier/DossierHero.tsx
import type { Creator } from '../../lib/types';

interface Props {
  creator: Creator;
  variant: 'wide' | 'tall';
  owed: number;
}

const STATUS_LABEL: Record<string, string> = {
  prospect: 'PROSPECT', onboarding: 'ONBOARDING', active: 'ACTIVE',
  paused: 'PAUSED', ended: 'ENDED',
};

/** Same content in both variants — only the arrangement differs (spec §5). */
export function DossierHero({ creator, variant, owed }: Props) {
  const stats = [
    { label: 'SHARE', value: creator.revenue_share != null ? `${creator.revenue_share}%` : '—' },
    { label: 'OWED', value: owed ? `€${owed.toLocaleString()}` : '—' },
    {
      label: 'SUBS',
      value: creator.subscriber_count?.toLocaleString() ?? '—',
      hint: creator.subscriber_count_as_of
        ? `as of ${creator.subscriber_count_as_of}`
        : undefined,
    },
  ];

  return (
    <div className={`dossier-hero dossier-hero-${variant}`}>
      <div className="dossier-hero-id">
        <span className="dossier-avatar">{creator.name[0]}</span>
        <div>
          <div className="dossier-hero-name">{creator.name}</div>
          <div className="dossier-hero-sub">
            {[creator.legal_name, creator.timezone].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      </div>
      <div className="dossier-hero-stats">
        {stats.map((s) => (
          <div key={s.label} className="dossier-stat">
            <b>{s.value}</b>
            <span>{s.label}</span>
            {s.hint && <em className="dossier-stat-hint">{s.hint}</em>}
          </div>
        ))}
      </div>
      <span className="dossier-badge">{STATUS_LABEL[creator.status] ?? creator.status}</span>
    </div>
  );
}
```

- [ ] **Step 2: Build the tiles**

```tsx
// src/views/dossier/tiles/EarningsTile.tsx
import { lastSixMonths } from '../../../lib/creators/earnings';
import type { CreatorEarning } from '../../../lib/types';

interface Props {
  earnings: CreatorEarning[];
  currency: string;
  readOnly: boolean;
  onRecord: () => void;
}

export function EarningsTile({ earnings, currency, readOnly, onRecord }: Props) {
  const series = lastSixMonths(earnings);
  const peak = Math.max(...series.map((s) => s.gross), 1);

  return (
    <div className="card tile">
      <div className="tile-head">
        <span className="tile-label">Earnings · 6 months</span>
        <button className="btn btn-tiny" disabled={readOnly} onClick={onRecord}>
          Record month
        </button>
      </div>
      {earnings.length === 0 ? (
        <p className="tile-empty">No earnings recorded yet.</p>
      ) : (
        <>
          <div className="tile-bars">
            {series.map((s, i) => (
              <i
                key={s.month}
                className={i === series.length - 1 ? 'hi' : ''}
                style={{ height: `${Math.max((s.gross / peak) * 100, 3)}%` }}
                title={`${s.month.slice(0, 7)} — ${s.gross.toLocaleString()} ${currency}`}
              />
            ))}
          </div>
          <div className="tile-foot">
            {series[series.length - 1].gross.toLocaleString()} {currency} this month
          </div>
        </>
      )}
    </div>
  );
}
```

```tsx
// src/views/dossier/tiles/LoginsTile.tsx
import { ServiceIcon } from '../../../components/ServiceIcon';
import type { Entry } from '../../../lib/types';

export function LoginsTile({ entries, onOpen }: { entries: Entry[]; onOpen: () => void }) {
  return (
    <button className="card tile tile-btn" onClick={onOpen}>
      <span className="tile-label">Logins · {entries.length}</span>
      {entries.length === 0 ? (
        <p className="tile-empty">No logins yet.</p>
      ) : (
        entries.slice(0, 4).map((e) => (
          <span key={e.id} className="tile-row">
            <ServiceIcon serviceKey={e.service_key} serviceUrl={e.service_url} size={16} />
            {e.service_name}
          </span>
        ))
      )}
    </button>
  );
}
```

```tsx
// src/views/dossier/tiles/PayoutTile.tsx
import type { Creator } from '../../../lib/types';

const METHOD_LABEL: Record<string, string> = {
  iban: 'IBAN', paypal: 'PayPal', wise: 'Wise', crypto: 'Crypto', other: 'Other',
};

export function PayoutTile({ creator }: { creator: Creator }) {
  return (
    <div className="card tile">
      <span className="tile-label">Payout</span>
      <div className="tile-value">
        {creator.payout_method
          ? `${METHOD_LABEL[creator.payout_method]} · ${creator.payout_currency ?? '—'}`
          : 'Not set'}
        {creator.payout_schedule ? ` · ${creator.payout_schedule}` : ''}
      </div>
      <span className="tile-label" style={{ marginTop: 10 }}>Contract</span>
      <div className="tile-value">
        {creator.contract_status === 'signed'
          ? `Signed${creator.start_date ? ` · ${creator.start_date}` : ''}`
          : creator.contract_status === 'sent'
            ? 'Sent, awaiting signature'
            : 'None'}
      </div>
    </div>
  );
}
```

```tsx
// src/views/dossier/tiles/LinksTile.tsx
import type { Creator, CreatorDocument } from '../../../lib/types';

interface Props {
  creator: Creator;
  documents: CreatorDocument[];
  onOpenDocuments: () => void;
}

export function LinksTile({ creator, documents, onOpenDocuments }: Props) {
  const links = [
    creator.of_url && { label: 'OnlyFans', url: creator.of_url },
    creator.getmysocial_url && { label: 'Getmysocial', url: creator.getmysocial_url },
    creator.drive_folder_url && { label: 'Drive folder', url: creator.drive_folder_url },
    ...creator.socials,
  ].filter(Boolean) as { label: string; url: string }[];

  return (
    <div className="card tile">
      <span className="tile-label">Links &amp; files</span>
      {links.length === 0 && <p className="tile-empty">No links yet.</p>}
      {links.map((l) => (
        <button
          key={l.url}
          className="tile-row tile-link"
          onClick={() => window.vaultBridge?.openExternal(l.url)}
        >
          🔗 {l.label} ↗
        </button>
      ))}
      <button className="tile-row tile-link" onClick={onOpenDocuments}>
        📄 {documents.length} document{documents.length === 1 ? '' : 's'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add the styles**

Append to `src/styles/global.css` — hero gradient matching the approved mockups, tile shells, and the two grid templates:

```css
/* --- Creator dossier ------------------------------------------------- */
.dossier-hero {
  background: linear-gradient(115deg, #00aff0 0%, #0090c9 50%, #7d3ba8 100%);
  color: #fff;
  border-radius: var(--radius);
  box-shadow: 0 3px 14px rgba(0, 120, 180, 0.25);
  padding: 16px 18px;
  display: flex;
  gap: 18px;
  position: relative;
}
.dossier-hero-wide { align-items: center; margin-bottom: 12px; }
.dossier-hero-tall { flex-direction: column; align-items: flex-start; grid-row: span 2; }
.dossier-hero-id { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.dossier-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.6);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 800; flex-shrink: 0;
}
.dossier-hero-name { font-size: 19px; font-weight: 800; }
.dossier-hero-sub { font-size: 12px; opacity: 0.9; }
.dossier-hero-stats { display: flex; gap: 22px; }
.dossier-hero-tall .dossier-hero-stats { flex-direction: column; gap: 12px; }
.dossier-stat b { display: block; font-size: 20px; font-weight: 800; line-height: 1.1; }
.dossier-stat span { font-size: 9px; font-weight: 700; letter-spacing: 0.07em; opacity: 0.85; }
.dossier-stat-hint { display: block; font-size: 9px; opacity: 0.75; font-style: normal; }
.dossier-badge {
  position: absolute; top: 14px; right: 16px;
  background: rgba(255, 255, 255, 0.22); border-radius: 99px;
  padding: 3px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.05em;
}
.dossier-grid-wide { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dossier-grid-tall { display: grid; grid-template-columns: 210px 1fr 1fr; gap: 12px; align-items: start; }

.tile { padding: 12px 14px; display: flex; flex-direction: column; text-align: left; }
.tile-btn { cursor: pointer; font: inherit; color: inherit; }
.tile-btn:hover { border-color: var(--accent); }
.tile-head { display: flex; justify-content: space-between; align-items: center; }
.tile-label {
  font-size: 9.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--ink-soft); margin-bottom: 5px;
}
.tile-value { font-weight: 700; font-size: 13px; }
.tile-empty { color: var(--ink-soft); font-size: 12.5px; margin: 4px 0 0; }
.tile-row {
  display: flex; align-items: center; gap: 7px; padding: 3px 0;
  font-size: 12.5px; background: none; border: none; color: inherit;
  text-align: left; font-family: inherit;
}
.tile-link { color: var(--accent-dark); cursor: pointer; }
.tile-link:hover { text-decoration: underline; }
.tile-bars { display: flex; align-items: flex-end; gap: 5px; height: 54px; margin-top: 6px; }
.tile-bars i { flex: 1; background: #cfeefb; border-radius: 3px 3px 0 0; }
.tile-bars i.hi { background: var(--accent); }
.tile-foot { font-size: 11.5px; color: var(--ink-soft); margin-top: 6px; }
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/views/dossier/ src/styles/global.css
git commit -m "feat: dossier hero and tiles shared across both layouts"
```

---

### Task 6: Dossier view, layout toggle, drill-down

**Files:**
- Create: `src/views/dossier/DossierView.tsx`, `src/views/dossier/DocumentsView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: hero and tiles (Task 5), queries (Task 3), `sortCreators` (Task 2)
- Produces: `<DossierView creator data readOnly user onEditCreator onRefresh />`

- [ ] **Step 1: Build the dossier container**

```tsx
// src/views/dossier/DossierView.tsx
import { useState } from 'react';
import { splitEarning } from '../../lib/creators/earnings';
import type { Creator, VaultData } from '../../lib/types';
import { DossierHero } from './DossierHero';
import { EarningsTile } from './tiles/EarningsTile';
import { LinksTile } from './tiles/LinksTile';
import { LoginsTile } from './tiles/LoginsTile';
import { PayoutTile } from './tiles/PayoutTile';

export type DossierLayout = 'wide' | 'tall';

interface Props {
  creator: Creator;
  data: VaultData;
  readOnly: boolean;
  onEdit: () => void;
  onOpenLogins: () => void;
  onOpenDocuments: () => void;
  onRecordEarnings: () => void;
}

export function DossierView({
  creator, data, readOnly, onEdit, onOpenLogins, onOpenDocuments, onRecordEarnings,
}: Props) {
  const [layout, setLayout] = useState<DossierLayout>(
    () => (localStorage.getItem('tg-vault-dossier-layout') as DossierLayout) ?? 'wide',
  );

  const switchLayout = (next: DossierLayout) => {
    localStorage.setItem('tg-vault-dossier-layout', next);
    setLayout(next);
  };

  const entries = data.entries.filter((e) => e.creator_id === creator.id);
  const documents = data.documents.filter((d) => d.creator_id === creator.id);
  const earnings = data.earnings
    .filter((e) => e.creator_id === creator.id)
    .sort((a, b) => a.month.localeCompare(b.month));
  const latest = earnings[earnings.length - 1];
  const owed = latest ? splitEarning(latest.gross, creator.revenue_share).creator : 0;
  const currency = creator.payout_currency ?? 'EUR';

  // One set of tiles, two containers — see spec §5.
  const tiles = (
    <>
      <EarningsTile
        earnings={earnings}
        currency={currency}
        readOnly={readOnly}
        onRecord={onRecordEarnings}
      />
      <LoginsTile entries={entries} onOpen={onOpenLogins} />
      <PayoutTile creator={creator} />
      <LinksTile creator={creator} documents={documents} onOpenDocuments={onOpenDocuments} />
    </>
  );

  return (
    <div className="view">
      <div className="view-header">
        <h1>{creator.name}</h1>
        <div className="filter-row">
          <button
            className={`btn btn-tiny ${layout === 'wide' ? 'btn-primary' : ''}`}
            onClick={() => switchLayout('wide')}
          >
            Wide
          </button>
          <button
            className={`btn btn-tiny ${layout === 'tall' ? 'btn-primary' : ''}`}
            onClick={() => switchLayout('tall')}
          >
            Compact
          </button>
          <button className="btn" disabled={readOnly} onClick={onEdit}>
            Edit creator
          </button>
        </div>
      </div>

      {layout === 'wide' ? (
        <>
          <DossierHero creator={creator} variant="wide" owed={owed} />
          <div className="dossier-grid-wide">{tiles}</div>
        </>
      ) : (
        <div className="dossier-grid-tall">
          <DossierHero creator={creator} variant="tall" owed={owed} />
          {tiles}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build the documents view**

```tsx
// src/views/dossier/DocumentsView.tsx
import { useState } from 'react';
import { MAX_UPLOAD_BYTES, validateDocument } from '../../lib/creators/validation';
import type { CreatorDocument } from '../../lib/types';

interface Props {
  documents: CreatorDocument[];
  readOnly: boolean;
  onAdd: (doc: {
    label: string; kind: CreatorDocument['kind'];
    url: string | null; file: File | null;
  }) => Promise<void>;
  onDelete: (doc: CreatorDocument) => void;
  onOpen: (doc: CreatorDocument) => void;
  onBack: () => void;
}

export function DocumentsView({ documents, readOnly, onAdd, onDelete, onOpen, onBack }: Props) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<CreatorDocument['kind']>('contract');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!label.trim()) { setError('Give the document a label.'); return; }
    const invalid = validateDocument({
      url: url.trim() || null,
      storagePath: file ? 'pending' : null,
      sizeBytes: file?.size ?? null,
    });
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    try {
      await onAdd({ label: label.trim(), kind, url: url.trim() || null, file });
      setAdding(false); setLabel(''); setUrl(''); setFile(null); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <button className="btn btn-tiny" onClick={onBack}>← Back</button>
          <h1 style={{ marginTop: 8 }}>Documents</h1>
        </div>
        <button className="btn btn-primary" disabled={readOnly} onClick={() => setAdding(true)}>
          + Add document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state card"><p>No documents yet.</p></div>
      ) : (
        <div className="entry-list">
          {documents.map((d) => (
            <div key={d.id} className="card entry-row">
              <div className="entry-main">
                <span>{d.kind === 'contract' ? '📄' : d.kind === 'id' ? '🪪' : '📎'}</span>
                <div className="entry-id">
                  <span className="entry-service">{d.label}</span>
                  <span className="pill">{d.url ? 'Link' : 'File'}</span>
                </div>
                <div className="entry-actions">
                  <button className="btn btn-tiny" onClick={() => onOpen(d)}>Open</button>
                  <button
                    className="icon-btn icon-btn-danger"
                    disabled={readOnly}
                    onClick={() => onDelete(d)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add document</h2>
            <label className="form-label">Label</label>
            <input className="input" value={label} autoFocus onChange={(e) => setLabel(e.target.value)} />
            <label className="form-label">Type</label>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as CreatorDocument['kind'])}
            >
              <option value="contract">Contract</option>
              <option value="id">ID</option>
              <option value="other">Other</option>
            </select>
            <label className="form-label">Drive link</label>
            <input
              className="input"
              placeholder="https://drive.google.com/…"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (e.target.value) setFile(null); }}
            />
            <label className="form-label">…or upload a file (max 10 MB)</label>
            <input
              className="input"
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                if (e.target.files?.[0]) setUrl('');
              }}
            />
            <p className="connect-hint">
              Anything big or sensitive belongs in Drive — link it instead of uploading.
            </p>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={submit}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: `MAX_UPLOAD_BYTES` is imported for the validator's size check via `validateDocument`; no separate check is needed.

- [ ] **Step 3: Route it in App.tsx**

Replace the `route.view === 'creator'` branch so it renders `DossierView`, with sub-state `creatorTab: 'overview' | 'logins' | 'documents'`. The existing `EntryListView` for that creator becomes the `logins` tab. Sort the sidebar creators with `sortCreators`. Add a `recordEarnings` modal (month input defaulting to the current month, gross, currency) calling `saveEarning`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test` → clean and green. Then `npm start` and check: dossier renders, both layouts switch and persist across restart, tiles open their views.

- [ ] **Step 5: Commit**

```bash
git add src/views/dossier/ src/App.tsx
git commit -m "feat: dossier view with switchable layouts and drill-down"
```

---

### Task 7: Creator edit modal, archive and delete guard

**Files:**
- Create: `src/views/dossier/CreatorModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `validateRevenueShare`, `validatePayout`, `showsPersonalFields` (Task 1); `createCreatorFull`, `updateCreator`, `canDeleteCreator`, `deleteCreator` (Task 3)

- [ ] **Step 1: Build the modal**

Sectioned form — Identity / Commercial / Payout / Platform — where `showsPersonalFields(kind)` is false collapses it to name, colour and status only. Validate with `validateRevenueShare` and `validatePayout` before saving; show the returned message in `.form-error`. Reuse `.input`, `.form-label`, `.form-row`, `.form-col`, `.modal-actions` classes exactly as `EntryModal` does.

- [ ] **Step 2: Wire archive and delete**

In `App.tsx`, the dossier's Edit modal gains two footer actions:

```tsx
<button className="btn" onClick={() => handleArchive(creator)}>
  {creator.status === 'ended' ? 'Restore' : 'Archive'}
</button>
<button className="btn btn-danger" onClick={() => attemptDelete(creator)}>
  Delete
</button>
```

```tsx
const attemptDelete = (creator: Creator) => {
  const blocked = canDeleteCreator(creator.id, data);
  if (blocked) {
    toast(blocked, 'error');
    return;
  }
  setPendingCreatorDelete(creator);
};

const handleArchive = async (creator: Creator) => {
  const next = creator.status === 'ended' ? 'active' : 'ended';
  await updateCreator(creator, { ...toInput(creator), status: next }, user);
  await refresh();
  toast(next === 'ended' ? 'Creator archived' : 'Creator restored');
};
```

`toInput(creator)` strips `id`, `created_at`, `updated_at`, `updated_by` — add it as a small helper beside the handlers.

- [ ] **Step 3: Verify the guard by hand**

Run `npm start`, open a creator that has logins, open Edit → Delete. Expected: red toast "Still holds N logins… Archive instead to keep the history." and nothing deleted. Then create a throwaway empty creator and confirm deletion works.

- [ ] **Step 4: Run the suite**

Run: `npm run typecheck && npm test` → clean and green.

- [ ] **Step 5: Commit**

```bash
git add src/views/dossier/CreatorModal.tsx src/App.tsx
git commit -m "feat: creator edit modal with archive and delete guard"
```

---

### Task 8: Ship

- [ ] **Step 1: Full verification**

```bash
npm run typecheck
npm test
```
Both must pass. Expected: 42 existing + ~20 new tests.

- [ ] **Step 2: Manual smoke**

`npm start`, then: create a creator with every section filled; add a Drive link and a small upload; record a month's gross and confirm the chart and "owed" update; switch layouts and restart to confirm persistence; attempt to delete a creator with logins; open a second window and confirm an edit appears live; check the activity feed shows field names and **no IBAN**.

- [ ] **Step 3: Publish**

```bash
npm version patch --no-git-tag-version
git add -A && git commit -m "chore: v1.0.5 — creator dossiers"
git push
GITHUB_TOKEN=<token> npm run publish
```

Gabriel's install picks it up within the hour. He must run `migration-003.sql`? No — the migration is on the shared database and only needs running once, by whoever runs it first.

---

## Self-Review

**Spec coverage:** §2 scope boundary — documented, no code needed. §3 personal data — Task 1 (ID reference as text), Task 3 (10 MB bucket limit), Task 6 (UI copy). §4 data model — Tasks 1 and 3; deletion guard Tasks 3 and 7. §5 screens — Tasks 5, 6, 7; activity logging Task 3; search Task 4. §6 backups — Task 4. §7 offline — inherited, no change. §8 testing — Tasks 1, 2, 4. §9 migration — Task 3. §10 out of scope — nothing built.

**Placeholders:** none. Task 7 Step 1 describes the modal rather than pasting it — the form is mechanical and mirrors `EntryModal`, whose classes are named explicitly; every validation call and CSS class it needs is specified.

**Type consistency:** `CreatorInput` (Task 1) is consumed by `updateCreator`/`createCreatorFull` (Task 3) and `changedFieldNames` (Task 2). `VaultData.documents`/`.earnings` added in Task 1, populated in Task 3, read in Tasks 4–6. `splitEarning` returns `{agency, creator}` in Task 2 and is destructured as `.creator` in Task 6. `DossierLayout` is `'wide' | 'tall'` in both the hero's `variant` prop and the toggle.
