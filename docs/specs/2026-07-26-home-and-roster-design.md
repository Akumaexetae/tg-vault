# T&G Vault — Income Home & Creator Roster — Design Spec

*Prepared 26 July 2026. Sub-project 2, following `2026-07-26-creator-dossiers-design.md`. Combined spec and task breakdown — the increment is small enough not to warrant a separate plan document.*

## 1. Purpose

Reorient the app around money and people rather than credentials:

- **Home** becomes an income dashboard — what came in this month, what's the agency's, what's owed out.
- **Creators** becomes a browsable roster of photo cards, so a creator is recognised at a glance rather than read.
- **Creators gain a photo**, uploaded once and reused as both card banner and avatar.

This pulls a light form of the Money module forward. The manual monthly figures from sub-project 1 are enough to make Home real; CSV import and payment tracking remain future work.

## 2. Navigation restructure

Current nav mixes top-level views with credential concerns. New structure:

| Section | Contains |
|---|---|
| **Home** | Income dashboard (below) |
| **Creators** | Roster of cards → drills into a dossier. Sidebar keeps the creator list beneath for fast switching. |
| **Vault** | All accounts, the service list, and password health (moved out of top level) |
| **Notes** | Secure notes, unchanged |
| **Activity** | Shared feed, unchanged |

Password health stops being a top-level item: it is a property of the vault, not of the business.

## 3. Home

**Three headline cards** for the current month, each with a month-on-month delta:

- **Gross** — sum of all creators' recorded gross
- **Your cut** — sum of the derived agency splits, visually emphasised as the number that matters
- **Owed to creators** — sum of the derived creator splits, with a count of creators awaiting payout

**Agency revenue, 6 months** — bar chart of the derived agency cut per month.

**This month by creator** — each creator with recorded earnings, highest first, showing gross.

**Needs attention** — a short list, each item actionable:
- Active creators with no earnings recorded for the current month
- Reused or weak passwords (count, linking to Vault → health)

Empty state: with no earnings recorded at all, Home shows a single "Record a month to see your income" prompt rather than a wall of zeros.

## 4. Creators roster

Grid of cards, one per creator, responsive down to two columns.

**Card:** photo as banner (or the creator's colour as a gradient when absent), circular avatar overlapping the banner, name, status pill, share % and login count, then this month's gross and subscriber count. Archived creators render dimmed. A dashed "+ Add creator" tile ends the grid.

**Filters:** status chips — All / Active / Archived — with counts.

Clicking a card opens that creator's dossier, unchanged from sub-project 1.

## 5. Photos

`creators.avatar_path` (nullable) referencing a public Supabase Storage bucket `avatars`.

- Accepted: PNG, JPEG, WebP. Rejected with a clear message otherwise.
- **Resized client-side before upload** to max 512×512, re-encoded as JPEG at ~0.85 quality. A phone photo becomes ~50 KB, so the bucket stays trivial in size and the grid stays fast.
- Hard cap 2 MB on the *source* file to avoid decoding something absurd.
- Replacing a photo overwrites the same path, so no orphans accumulate.
- The bucket is public-read: these are public-facing persona photos, and a signed URL per card per render would be needless work. Nothing private belongs here — that rule is stated in the upload UI.

Fallback everywhere: the coloured initial already used in the sidebar.

## 6. Data model

Only one column added — `creators.avatar_path text`. All money figures are derived from the existing `creator_earnings` and `creators.revenue_share`; nothing is stored twice.

## 7. Testing

New pure logic in `src/lib/money.ts`, unit tested:

- `monthTotals(earnings, creators, month)` → gross, agency, creators — summed across creators using each creator's own share
- Creators with different shares are split individually, not with a blended rate
- `monthDelta(current, previous)` → percentage change, with a null result when the previous month is zero (no divide-by-zero, no "+∞%")
- `agencySeries(earnings, creators, months)` → 6-month agency-cut series, zero-filled
- `creatorsMissingEarnings(creators, earnings, month)` → active creators only; archived and agency rows excluded
- `resizeImage` guards: rejects non-images, rejects over 2 MB

Existing 71 tests stay green.

## 8. Migration

`supabase/migration-004.sql`: adds `creators.avatar_path`, creates the public `avatars` bucket with a 2 MB limit and an allow-all policy consistent with the other buckets.

## 9. Task breakdown

1. **Money aggregation** — `src/lib/money.ts` + tests. No UI.
2. **Avatars** — migration, `resizeImage` helper + tests, upload control in the creator modal, `avatar_path` through the data layer.
3. **Home** — `src/views/HomeView.tsx` using the aggregations.
4. **Roster** — `src/views/CreatorsView.tsx` + `CreatorCard.tsx`.
5. **Nav restructure** — Home / Creators / Vault / Notes / Activity; health moves under Vault.
6. **Ship** — verify, publish v1.0.5.

## 10. Out of scope

OnlyFans CSV import, payment tracking (marking a payout as sent), multi-currency conversion (each creator's figures stay in her own currency; Home sums only matching currencies and labels mixed totals), the planning canvas, Google Drive API integration.
