# T&G Vault

Internal desktop app for T&G AGENCY — two partners, two installs, one live database. It began as a password vault and grew into the pair's private cockpit: credentials, creator records, income and planning.

**No encryption by design.** Everything is stored and transmitted in plaintext; the only protection is that the database is private and passwords are masked on screen. That is defensible *only* because exactly two trusted people use it. Don't put anything here you wouldn't put in a shared spreadsheet.

## Scope — what belongs here

T&G runs two apps and they must not converge:

| | **This app** (Electron, desktop) | **CRM** (Next.js, web) |
|---|---|---|
| Users | The two partners only | Partners + VAs/managers |
| Auth | None, deliberately | Yes, with roles |
| Holds | Credentials, money, contracts, private planning | Accounts, GeeLark automation, captions, schedules |

Anything a VA needs belongs in the CRM. Adding it here would force auth into this app and turn it into a second CRM.

## Running it

```bash
npm start          # dev
npm test           # unit tests
npm run typecheck  # tsc
npm run make       # Windows installer → out/make/squirrel.windows/x64/
```

## Features

**Credentials**
- Accounts organised by service × creator; "Agency" is the built-in owner for shared logins
- 15 bundled service logos; anything else auto-fetches its favicon
- Live 2FA codes from stored TOTP secrets — paste a base32 secret or a whole `otpauth://` link
- One-click login: opens the service in a window with a session isolated *per account* (`persist:acct-<id>`), so many accounts on one service stay logged in side by side. Fills username, password and the 2FA code; never auto-submits
- Per-account proxy — `user:pass@host:port` routes that account's login window
- Password history (last 10), pinned favourites, health checks (weak / reused / ageing)
- `Ctrl+K` palette — `Enter` copies the password, `Shift+Enter` opens the login window

**Creators**
- A dossier per creator: identity, commercial terms, payout details, platform links, documents
- Two switchable overview layouts, remembered per install
- Roster of photo cards; avatars are shrunk to 512px client-side before upload
- Deleting a creator is blocked while she has logins, documents or earnings — archive instead

**Money**
- Monthly gross per creator, entered by hand or imported from any CSV
- Agency cut and creator payout **derived** from the revenue share, never stored, so changing a share doesn't rewrite history
- Totals grouped by currency — EUR is never silently added to USD
- Payout tracking: mark a month paid, with who and when

**Planning — board**
- Shared board (To do / Doing / Done) with drag-and-drop and live sync
- Cards carry notes, assignee, an optional creator link and a due date; overdue cards flag
- Fractional indexing, so moving a card writes one row rather than renumbering its column

**Planning — canvas**
- Infinite pan/zoom surface, multiple named boards
- Notes, text, boxes, ellipses, diamonds, arrows, tables and images
- Tables store their grid as JSON in the object's `text` field — no schema of their own, and they inherit sync, undo and delete unchanged
- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) recording only the objects each step touched, coalescing a drag into one step
- Multi-select (`Shift+drag` or `Shift+click`), group move, duplicate (`Ctrl+D`), copy/paste
- Paste or drop a screenshot; images are re-encoded to 1600px JPEG before upload
- Arrows attach to shapes and follow them, meeting the edge rather than the centre; loose arrows draw dashed
- Live cursors over an ephemeral broadcast channel — a pointer moving 20×/sec is not data worth storing

**Everything else**
- Secure notes for anything that isn't a login
- One activity feed across the app — field *names* are logged, never values, so an IBAN can't leak into it
- JSON and CSV backups
- Offline: reads fall back to the last synced snapshot, editing disabled until reconnected

## Database

**`supabase/all.sql` is every migration in one file.** Paste it into the SQL editor and run — it's guarded throughout, so it brings an empty *or* half-migrated database up to date, and re-running it is harmless. That's the only thing to run on a new database.

The individual files are kept for history:

| File | Adds |
|---|---|
| `supabase/schema.sql` | creators, entries, activity |
| `migration-002.sql` | pinned, password history, proxy, secure_notes |
| `migration-003.sql` | dossier fields, documents, earnings, `on delete restrict` |
| `migration-004.sql` | creator avatars |
| `migration-005.sql` | payout tracking |
| `migration-006.sql` | planning board |
| `migration-007.sql` | planning canvas |
| `migration-008.sql` | canvas images bucket |
| `migration-009.sql` | arrows attached to shapes |

Three storage buckets are needed: **`avatars`** (public), **`documents`** (private, 10 MB) and **`canvas-images`** (public, 5 MB). Creating them in the dashboard is more reliable than SQL, and each needs a policy on `storage.objects` — RLS there is always on and can't be disabled.

### Why the key is a master key

RLS is disabled on our tables with permissive policies, because there are no logins to key it on. **That makes the publishable key full read/write access to everything**, despite Supabase's UI calling publishable keys safe to share — that guidance assumes RLS is on.

So the connection is **not** in this repository. Each install asks for the URL and key on first launch and keeps them in `localStorage`. The published binary contains no secret, which is what lets this repo be public. Don't reintroduce a compiled-in key.

Bulk content never enters the database: photos and videos live in Drive and the app stores links. 2,000 photos is roughly 10 GB against a 1 GB free tier, and egress bills every preview.

## Auto-update

The app reads `https://github.com/Akumaexetae/tg-vault/releases/latest/download/` directly — Squirrel fetches `RELEASES` and the `.nupkg` from there. No third-party update server, so a release is live the moment it's published. Checks on launch and hourly; a banner offers a restart once downloaded.

```bash
npm version patch --no-git-tag-version
git commit -am "chore: vX.Y.Z" && git push
GITHUB_TOKEN=<token with repo scope> npm run publish
```

Releases publish immediately rather than as drafts — a forgotten draft is indistinguishable from "no update available". The first install on a new machine still has to be by hand.

## Notes

- The folder is `TG Vault`, not `T&G Vault` — the ampersand breaks npm's Windows shims. The product name is still "T&G Vault".
- Node 22 can't run Electron's `install.js` directly; if `node_modules/electron/dist` is missing, run `node --experimental-require-module node_modules/electron/install.js`.
- `vitest.config` must be `.mts`.
- Identity (Tyler/Gabriel) lives in `localStorage` under `tg-vault-user`.
- Specs and plans are in `docs/` — this app's, not the CRM's.
