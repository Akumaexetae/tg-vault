# T&G Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Executed inline in the authoring session (owner requested speed). Spec: `../specs/2026-07-26-password-vault-design.md`.

**Goal:** Electron desktop password vault for T&G Agency, shared live between Tyler and Gabriel via Supabase.

**Architecture:** Electron Forge + Vite + React (TS) renderer talking directly to Supabase (`supabase-js`, realtime). Electron main process handles window + local JSON cache IPC. No app backend.

**Tech Stack:** electron-forge (vite-typescript template), react, @supabase/supabase-js, otpauth, simple-icons (brand logos), vitest.

## Global Constraints

- Project root: `C:\Users\Tyler\Desktop\T&G Vault` (own git repo; package name `tg-vault`, product name "T&G Vault").
- Theme: bright; white→`#00AFF0` gradient page background, white cards, blue pills. No dark theme.
- Two hardcoded users: `"Tyler" | "Gabriel"`; identity picked on first launch, stored via localStorage.
- No encryption, no auth, no password generator. Masked-until-reveal passwords only.
- All copy in English.

---

### Task 1: Scaffold + repo
Forge `vite-typescript` template → add React + deps → verify `npm start` opens window → git init + first commit.

### Task 2: Supabase schema + client
- `supabase/schema.sql`: tables `creators(id uuid pk, name text unique, color text)`, `entries(id uuid pk, service_name text, service_key text, service_url text, creator_id uuid fk, username text, password text, totp_secret text, recovery text, custom_fields jsonb default '[]', notes text, created_at, updated_at, updated_by text)`, `activity(id uuid pk, who text, action text, entry_label text, created_at)`; RLS disabled; realtime enabled; seed creator `Agency` (color `#00AFF0`).
- `src/lib/supabase.ts`: client from `src/config.ts` (`SUPABASE_URL`, `SUPABASE_ANON_KEY` constants; placeholder values until owner's project exists).
- `src/lib/types.ts`: `Creator`, `Entry`, `CustomField {key,value}`, `Activity`, `User = "Tyler" | "Gabriel"`.

### Task 3: Service catalog + logos
- `src/lib/catalog.ts`: `SERVICES: ServiceDef[]` — `{key, name, url, icon}` for OnlyFans, Getmysocials, Onlychat, SMSPool, Instagram, TikTok, Threads, X, Reddit, Snapchat, Telegram, Discord, Gmail, GeeLark, Qonto.
- Icons: `simple-icons` slugs where they exist (onlyfans, instagram, tiktok, threads, x, reddit, snapchat, telegram, discord, gmail); brand-colored rounded square with SVG path. Others (Getmysocials, Onlychat, SMSPool, GeeLark, Qonto): favicon `https://www.google.com/s2/favicons?domain=<url>&sz=64` with generic key-icon fallback. Custom services same favicon path.
- `ServiceIcon` React component resolves key → icon, handles fallback on img error.
- Vitest: catalog integrity (unique keys, 15 entries, resolvable icons).

### Task 4: Data layer
- `src/lib/queries.ts`: `fetchAll()` → `{creators, entries, activity}`; `createEntry/updateEntry/deleteEntry` (each also inserts activity row, stamps `updated_by`); `createCreator`; `logActivity`.
- `src/hooks/useVault.ts`: loads all data, subscribes to realtime `postgres_changes` on the three tables → refetch; exposes `{data, status: "loading"|"online"|"offline", retry}`. On success pushes snapshot to main via IPC `cache:save`; on failure reads `cache:load`.
- Main process: `cache.ts` — save/load JSON at `app.getPath("userData")/vault-cache.json`; preload exposes `window.vaultCache`.
- Vitest: activity label formatter, search/filter helpers (`src/lib/search.ts`: match on service, creator name, username, notes).

### Task 5: Shell + theme
- `src/App.tsx`: identity gate → shell. `IdentityScreen` (Tyler/Gabriel cards).
- `Shell`: top bar (logo/title + global search input), sidebar (Dashboard, All accounts, Services w/ icon+count, Creators w/ initial avatar+count, Activity), main outlet. Simple state routing (no router lib).
- `src/styles/global.css`: gradient background `linear-gradient(180deg, #ffffff 0%, #e8f7ff 45%, #b3e7fc 100%)`, card/pill/button classes, `#00AFF0` accent.

### Task 6: Entry row + TOTP
- `EntryRow`: service icon, creator pill, username + copy, password masked `••••••••` (click toggles reveal) + copy, TOTP live code (otpauth `TOTP.generate()`, 1s interval, countdown ring) when secret set, expander for recovery / custom fields / notes, edit + delete buttons.
- `useTotp(secret)` hook; Vitest against RFC 6238 test vector (SHA-1, known secret/time).
- Copy = `navigator.clipboard.writeText` + "Copied" toast.

### Task 7: Views
- `DashboardView`: stat cards (accounts, services, creators), recently updated (top 8 by `updated_at`), activity feed (top 10), search results when query active.
- `AllAccountsView`: all entries + service/creator filter chips.
- `ServiceView` / `CreatorView`: filtered `EntryRow` lists (creator view grouped by service).
- `ActivityView`: full feed with relative timestamps (`src/lib/time.ts` `timeAgo()`; Vitest).

### Task 8: Add/Edit modal + delete
- `EntryModal`: service logo grid + custom service (name+URL), creator select + inline add, username, password (plain text input), TOTP secret, recovery textarea, custom key/value rows, notes. Validation: service + creator + username required.
- `ConfirmDialog` for delete. All mutations log activity + toast on failure.

### Task 9: Offline banner + polish
- Offline: red banner "Offline — showing last synced data", disable all mutation buttons.
- Empty states, window title/icon, `npm test` green.

### Task 10: Supabase project wiring + installer
- Guide owner through creating Supabase project, run schema.sql, paste URL+anon key into `src/config.ts`.
- Smoke test two windows for realtime sync.
- `npm run make` → Windows installer under `out/`; hand `.exe` path to owner for Gabriel.
