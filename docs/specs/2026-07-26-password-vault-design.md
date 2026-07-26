# T&G Vault — Shared Password Manager — Design Spec

*Prepared 26 July 2026 for T&G AGENCY (OFM project). Companion to `TG_Agency_Full_Context_Handoff.md`.*

## 1. Purpose

A Windows desktop app (Electron) shared by exactly two users — Tyler and Gabriel — that stores every credential the agency uses (OnlyFans, Getmysocials, Onlychat, SMSPool, socials, tools) in one place, organized CRM-style by **service × creator**, with live sync between both machines.

Explicit decisions:
- **No encryption / no login** — trusted two-person tool by explicit owner choice. The only protection is visual (passwords masked until revealed).
- **Two users only** — no roles, no invites, no multi-tenancy. Each install identifies as Tyler or Gabriel (picked on first launch, stored locally) purely to stamp writes and the activity feed.

## 2. Architecture & Stack

- **App**: Electron Forge + Vite + React (TypeScript), plain CSS modules — same styling approach as the CRM app.
- **Data**: Supabase free tier — Postgres + `supabase-js` called directly from the renderer with the anon key baked into app config. RLS permissive (private project, two trusted users). No backend of our own.
- **Live sync**: Supabase Realtime subscription on all three tables — an edit on one machine appears on the other within ~1s.
- **TOTP**: `otpauth` library in the renderer generates live 6-digit codes from stored secrets.
- **Packaging**: Forge maker produces a Windows installer (`.exe`); Tyler builds once and sends the installer to Gabriel.

Rejected alternatives:
- *Synced-folder JSON file*: zero backend but sync timing is at the mercy of Drive/Dropbox and conflicts are ugly — owner chose cloud DB.
- *Vanilla JS renderer*: smaller scaffold, but modals, filters, TOTP countdowns, and realtime updates get unmanageable; React chosen.
- *Tauri*: smaller installer, but needs a Rust toolchain and owner asked for Electron.

## 3. Theme

Bright, **not** the CRM's dark theme:
- Background: white → OnlyFans-blue gradient (GeeLark-style airy look).
- Accent: OnlyFans blue `#00AFF0`; blue pill tags; white cards with soft shadows and rounded corners.
- Left sidebar + main content shell, mirroring the CRM's layout language.

## 4. Data Model (Supabase)

| Table | Key fields | Notes |
|---|---|---|
| **creators** | id, name, color | "Agency" is a built-in creator for shared/agency-level logins |
| **entries** | id, service_name, service_key (logo lookup), service_url, creator_id, username, password, totp_secret (nullable), recovery (text, nullable), custom_fields (JSONB array of {key, value}), notes, created_at, updated_at, updated_by | One row per credential |
| **activity** | id, who ("Tyler"/"Gabriel"), action (created/updated/deleted), entry_label, created_at | Append-only feed |

Services are **not** a table — a service is just `service_name` + `service_key` + `service_url` on the entry, with the sidebar service list derived by grouping entries. Bundled services come from a static in-app catalog (name, logo, URL); custom services store their own URL and use a fetched favicon.

## 5. Screens

- **Shell** — custom top bar (app name + global search). Sidebar: Dashboard · All accounts · Services (logo + count each) · Creators (initial avatar + count each) · Activity.
- **Dashboard** — stat cards (total accounts, services count, creators count), recently-updated list, live activity feed, big search bar.
- **Service view** — header with logo + name; entries as rows: creator pill, username + copy button, password as `••••••` (click to reveal) + copy button, live TOTP code with countdown ring when a secret is set; row expands to show recovery info, custom fields, notes.
- **Creator view** — same row component filtered to one creator, grouped by service.
- **All accounts** — every entry, searchable/filterable by service and creator.
- **Activity** — full feed: "Tyler updated Bella's OnlyFans password — 2h ago".
- **Add/Edit modal** — service picker as a logo grid (bundled catalog) + "custom service" option (name + URL → favicon); creator picker (+ inline "new creator"); username, password, TOTP secret, recovery text, custom key/value rows (add/remove), notes.
- **Delete** — confirmation dialog; deletion logged to activity.
- **First launch** — "Who are you?" screen: Tyler / Gabriel; choice stored locally, stamps all writes.

Copy-to-clipboard everywhere (username, password, TOTP code); global search matches service, creator, username, and notes.

## 6. Service Logo Catalog

Bundled logos (SVG/PNG in-app): OnlyFans, Getmysocials, Onlychat, SMSPool, Instagram, TikTok, Threads, X/Twitter, Reddit, Snapchat, Telegram, Discord, Gmail/Google, GeeLark, Qonto. Fallback: generic key icon. Custom services: favicon via `https://www.google.com/s2/favicons?domain=<url>&sz=64`, falling back to the key icon if unavailable.

## 7. Errors & Offline

- On every successful fetch, the full dataset is cached to a local JSON file (via Electron main process).
- If Supabase is unreachable: red "Offline — showing last synced data" banner; reads come from the cache; **writes are blocked** ("reconnect to edit"). No conflict resolution — two users, low write volume, YAGNI.
- Failed writes while online: toast with retry; no silent failures.

## 8. Testing

- Unit tests (Vitest) for the pure logic: TOTP code generation against known RFC vectors, search/filter functions, activity-label formatting, catalog/favicon fallback resolution.
- Manual smoke checklist for app flows (launch, identify, CRUD entry, reveal/copy, realtime sync between two windows, offline banner) — appropriate scale for an internal two-user tool; no E2E harness.

## 9. Setup & Delivery

1. Create Supabase project (2 minutes, guided) → run provided SQL to create tables + disable RLS restrictions.
2. Bake project URL + anon key into app config.
3. Seed the "Agency" creator.
4. Build Windows installer; Tyler installs, picks "Tyler"; sends installer to Gabriel, who picks "Gabriel".

Out of scope (explicitly): encryption, auth, roles/third users, browser extension, autofill, mobile, password generator (declined), import from other password managers.
