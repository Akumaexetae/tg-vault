# T&G Vault — Creator Dossiers — Design Spec

*Prepared 26 July 2026 for T&G AGENCY. Sub-project 1 of expanding T&G Vault into a founders' cockpit. Companion to `2026-07-26-password-vault-design.md`.*

## 1. Purpose

Turn a creator from a coloured tag on a credential into a real record: who she is, what the deal is, how she gets paid, where her documents and content live, and which logins are hers.

This is the spine of everything that follows — Money hangs off the revenue share, Docs off the document list, Planning references creators. Building it first means later modules slot in rather than bolt on.

## 2. Scope boundary — why this lives in the vault, not the CRM

T&G runs two apps and they must not converge:

| | **CRM** (Next.js, web) | **Vault** (Electron, desktop) |
|---|---|---|
| Users | Tyler, Gabriel, + VAs/managers | **Tyler and Gabriel only** |
| Auth | Yes, with roles | None, by design |
| Holds | Accounts, GeeLark automation, captions, schedules, publishing | Credentials, money, contracts, private planning |

The vault has no login and no encryption. That is defensible *only* while two trusted people use it. Creator DOBs, ID references and IBANs belong here precisely because VAs must never see them — and nothing that a VA needs may be added here, since that would force auth into the vault and turn it into a second CRM.

## 3. Personal data — deliberate limits

Holding creators' dates of birth, nationality, ID references and bank details makes T&G a data controller under GDPR. The vault is unencrypted, so the design limits exposure rather than pretending it doesn't exist:

- **ID documents are references, not scans.** A text field ("FR passport ••••4821") plus a Drive link. No passport images in the app or database.
- **Bulk content never enters the vault.** Photos and videos live in Drive; the vault stores links. Supabase is unsuitable at any tier — 2,000 photos ≈ 10 GB against a 1 GB free / 100 GB Pro allowance, and egress bills every preview.
- **Uploads are capped at 10 MB**, with the reason stated in the UI, so the exception cannot quietly become a content dump.

## 4. Data model

### `creators` — extended

Existing rows keep working: `kind` defaults to `creator`, `status` to `active`, everything else nullable.

| Group | Fields |
|---|---|
| Existing | `id`, `name` (stage name), `color` |
| Classification | `kind` (`creator` \| `agency`), `status` (`prospect` \| `onboarding` \| `active` \| `paused` \| `ended`) |
| Identity | `legal_name`, `date_of_birth`, `nationality`, `id_reference`, `email`, `phone`, `telegram`, `timezone` |
| Commercial | `revenue_share` (numeric 0–100, the agency's cut), `start_date`, `contract_status` (`none` \| `sent` \| `signed`), `notice_period_days`, `minimum_guarantee` |
| Payout | `payout_method` (`iban` \| `paypal` \| `wise` \| `crypto` \| `other`), `payout_details`, `payout_currency`, `payout_schedule` (`weekly` \| `monthly`) |
| Platform | `of_url`, `getmysocial_url`, `socials` (jsonb `[{label,url}]`), `subscriber_count` |
| Files | `drive_folder_url` |
| Meta | `created_at`, `updated_at`, `updated_by` |

`kind = 'agency'` hides every Identity, Commercial and Payout field — this is how the existing "Agency" row stays valid without special-casing a magic name.

Platform group also carries `subscriber_count_as_of` (date) — the count is hand-entered with no API behind it, and an undated figure reads as current long after it stops being true.

### `creator_documents` — new

`id`, `creator_id`, `label`, `kind` (`contract` \| `id` \| `other`), `url` (nullable), `storage_path` (nullable), `size_bytes`, `created_at`, `updated_by`.

Exactly one of `url` / `storage_path` is set — a document is either a link or an upload, never both. Uploads go to a Supabase Storage bucket `documents`, 10 MB limit enforced client-side and by bucket policy.

### `creator_earnings` — new

`id`, `creator_id`, `month` (date, first of month), `gross` (numeric), `currency`, `notes`, `created_at`, `updated_by`. Unique on `(creator_id, month)`.

One hand-entered row per creator per month, entered from the dossier. The agency cut and creator payout are **derived** at read time from `creators.revenue_share`, never stored — a share change must not silently rewrite history, and storing both invites them to disagree.

This makes the earnings chart and "owed now" real from day one, and gives the Money module something to build on rather than starting from an empty table. Money will add CSV import of OnlyFans statements, cross-creator reporting and payment tracking; the manual entry path stays as the fallback.

### Referential integrity — deletion

`entries.creator_id` is currently `on delete cascade`: deleting a creator destroys every credential, TOTP secret and password history belonging to her, silently. Dossiers make creators feel like records and add an `ended` status that invites tidying up, so this becomes a live data-loss risk.

Migration changes it to **`on delete restrict`** across `entries`, `creator_documents` and `creator_earnings`. The UI blocks deletion while any of those exist and points at **archive** (status → `ended`) instead. Archived creators drop to the bottom of the sidebar, dimmed, fully intact. Deleting a genuinely empty creator stays possible.

## 5. Screens

### Dossier overview — two switchable layouts

Both layouts render **identical tile components**; only the hero shape and the grid template differ. This constraint is the design: it keeps one implementation, not two pages.

- **H1 — full-width hero:** gradient banner across the top (avatar, name, status badge, stats inline), tiles in a 2×2 grid below.
- **H2 — hero as tall tile:** hero is a portrait card in the left column with stats stacked; tiles fill the remaining columns.

Toggle lives in the dossier header and is stored per install (`localStorage: tg-vault-dossier-layout`), so Tyler and Gabriel can differ.

**Tiles (same in both):** Earnings (6-month bar chart from `creator_earnings`, with an "add this month" control), Logins (count + first few services), Payout & Contract, Links & Files.

**Hero stats:** revenue share, owed now (latest month's gross × share, derived), subscriber count with its as-of date.

With no earnings recorded yet, the tile shows a single "Record this month's gross" action rather than a dead chart.

### Drill-down

Tiles are summaries; clicking one opens the corresponding detail view — **Logins** (today's creator view, unchanged), **Documents**, **Notes**, later **Money**. A back control returns to the overview.

### Edit

One "Edit creator" modal, sectioned to mirror the data model (Identity / Commercial / Payout / Platform), with `kind = 'agency'` collapsing it to name and colour only.

### Sidebar

Creator entries gain a status dot; `paused` and `ended` render dimmed. Ordering: active first, then by name.

### Activity logging

Dossier edits join the shared feed — a revenue share moving 45% → 30%, or an IBAN being swapped, is exactly what the other partner should see happened.

**Field names are logged; values are not.** "Gabriel updated Bella's payout details and revenue share" belongs in a feed both of you read; the IBAN itself does not, and the feed is the one table we'd hand to a future audit. Same rule for documents (added/removed by label) and earnings (month recorded).

### Search

Global search and the Ctrl+K palette extend to creator legal name, email and Telegram handle, so "find Bella's Telegram" works. Payout details are deliberately **excluded** from search — an IBAN should not surface from a stray keystroke.

## 6. Backups

The JSON export is the only safety net for an unencrypted vault with a single cloud copy, so it must stay a *complete* snapshot: it gains the new creator fields, `creator_documents` (links and storage paths) and `creator_earnings`. The CSV gains a creators sheet — stage name, legal name, status, share, payout method and currency — alongside the existing accounts rows.

Uploaded files themselves are not included; the export records their storage paths, and Drive holds anything that matters. This is stated in the UI so "I have a backup" never means more than it does.

## 7. Errors & offline

Unchanged from the existing rule — offline serves the last synced snapshot read-only, editing disabled. Document uploads require connectivity and are blocked offline with the same banner. Failed uploads surface a toast and leave no orphan row.

## 8. Testing

Vitest over the new pure logic:

- Revenue share bounds (0–100, rejects negatives and >100)
- Payout method/details validation per method
- Document rule: exactly one of url/storage_path
- Upload size guard at the 10 MB boundary
- `kind = 'agency'` field visibility
- Status ordering and sidebar sort
- Earnings split derivation: gross × share → agency cut and creator payout, including rounding at fractional cents
- Earnings history is unaffected by a later share change (derivation reads the share at render time; the test pins the expectation so nobody "optimises" it into a stored column)
- Deletion guard: a creator with entries, documents or earnings cannot be deleted; an empty one can
- Activity formatter emits changed **field names** and never values — asserted against a payout-details change

Existing 42 tests stay green. Manual smoke: create a creator, fill each section, add a link and an upload, record a month's gross, switch layouts, attempt to delete a creator with logins, verify realtime sync in a second window.

## 9. Migration

`supabase/migration-003.sql`, run once, safe to re-run:

- Adds the `creators` columns with defaults so existing rows stay valid
- Creates `creator_documents` and `creator_earnings`
- Creates the `documents` storage bucket with a 10 MB limit
- **Rebuilds `entries.creator_id` as `on delete restrict`** (drop and re-add the constraint — the column and its data are untouched)
- Disables RLS with allow-all policies, matching the existing tables
- Adds the new tables to the realtime publication

The FK change is the only destructive-sounding step; it alters a constraint, not data, and is safe to run against the live vault.

## 10. Out of scope

Money calculations and CSV import (next sub-project). Google Drive API integration — dossiers store and open plain URLs, which needs no OAuth. Planning canvas. Any OnlyFans scraping or unofficial API: OF publishes no API, and automating the site risks creators' accounts; earnings will come from OF's own CSV statements when Money is built.
