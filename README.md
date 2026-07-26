# T&G Vault

Shared password vault for T&G AGENCY — Tyler and Gabriel, two installs, one live database.

**No encryption by design.** Passwords are stored and transmitted in plaintext; the only protection is that the Supabase project is private and passwords are masked on screen. Don't put anything in here you wouldn't put in a shared spreadsheet.

## Running it

```bash
npm start          # dev
npm test           # unit tests
npm run typecheck  # tsc
npm run make       # build the Windows installer → out/make/squirrel.windows/x64/
```

## Features

- **Accounts by service × creator** — sidebar lists both; "Agency" is the built-in creator for shared logins.
- **15 bundled service logos** (OnlyFans, Getmysocials, Onlychat, SMSPool, Instagram, TikTok, Threads, X, Reddit, Snapchat, Telegram, Discord, Gmail, GeeLark, Qonto); anything else auto-fetches its favicon.
- **Live 2FA codes** from stored TOTP secrets — paste a base32 secret or a whole `otpauth://` link.
- **One-click login** — opens the service in a window with a session isolated *per account* (`persist:acct-<id>`), so many accounts on one service stay logged in side by side. Fills username, password, and the 2FA code; never auto-submits. "Clear saved session" resets one account.
- **Per-account proxy** — `user:pass@host:port` routes that account's login window.
- **Ctrl+K palette** — search, `Enter` copies the password, `Shift+Enter` opens the login window.
- **Password history** — the previous password is kept (last 10) whenever one changes.
- **Pinned favorites**, **secure notes**, **password health** (weak / reused / 6-months-old), **activity feed**.
- **Backups** — sidebar buttons export the whole vault as JSON or CSV.
- **Offline** — reads fall back to the last synced snapshot; editing is disabled until reconnected.

## Database

Supabase project `bwzrtosxnlxeqpnbwjjq`. Run in the SQL editor, in order:

1. `supabase/schema.sql` — creators, entries, activity
2. `supabase/migration-002.sql` — pinned, history, proxy, secure_notes

RLS is disabled with permissive policies as a fallback — a deliberate choice for a private two-person tool. Credentials live in `src/config.ts` and are baked into the build, so changing them means rebuilding both installs.

## Auto-update

The app reads `https://github.com/Akumaexetae/tg-vault/releases/latest/download/` directly — Squirrel fetches `RELEASES` and the `.nupkg` from there. No third-party update server. Checks on launch and hourly; when an update downloads, a banner offers a restart.

Releases live in the private repo `Akumaexetae/tg-vault`.

To ship an update to both installs:

```bash
npm version patch
GITHUB_TOKEN=<token with repo scope> npm run publish
```

Both installs pick it up within the hour and apply it on next launch — no more emailing installers. Gabriel still needs the *first* install by hand.

Note: `update-electron-app` reads releases from the repo, so the token used to publish must have `repo` scope on this private repo.

## Notes

- The folder is `TG Vault`, not `T&G Vault` — the ampersand breaks npm's Windows shims. The app's product name is still "T&G Vault".
- Node 22 can't run Electron's `install.js` directly; if `node_modules/electron/dist` is missing, run `node --experimental-require-module node_modules/electron/install.js`.
- Identity (Tyler/Gabriel) is stored in `localStorage` under `tg-vault-user`.
