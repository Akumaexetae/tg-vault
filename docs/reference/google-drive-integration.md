# Google Drive integration — implementation notes & CRM handoff

*Written 28 July 2026, after building this in T&G Vault (Electron desktop). Intended for whoever implements Drive browsing in the GeeLark CRM (Next.js web).*

**Read the "What does NOT port" section before copying anything.** The two apps need different OAuth client types and different secret handling. Copying the desktop approach into a web app would be both broken and insecure.

---

## 1. What was built

Browse a creator's Google Drive folder from inside the app: folder navigation with breadcrumbs, a thumbnail grid for photos and videos, a list view, and click-through to open a file in the browser. Read-only.

In the Vault it hangs off `creators.drive_folder_url` — each creator stores a Drive folder link, and the sidebar lists creators who have one.

---

## 2. Google Cloud setup (one-time, mostly shared)

The same Cloud project can serve both apps. What follows is what actually mattered; the console's own wording is misleading in places.

1. **Create a project.** (Ours is confusingly named `Tg CRM` but currently powers the Vault.)
2. **Enable the Google Drive API.** Without it, sign-in succeeds and *then* every list call fails with "Drive API has not been used in project…". Easy to misdiagnose as an auth problem.
3. **OAuth consent screen → Audience.** Add every Google account that will sign in as a **Test user** while the app is unpublished. Being the project owner does *not* reliably exempt you.
4. **Create an OAuth client** — see the table below for which type.

### Publishing status matters more than it looks

While the app is in **Testing**, Google **expires refresh tokens after 7 days**. Users would have to re-authenticate weekly.

To avoid that, **publish the app**. With a sensitive scope (`drive.readonly`) on a non-Workspace account you won't be verified, so the first sign-in shows *"Google hasn't verified this app"* → **Advanced → Go to (unsafe)**. After that, tokens persist normally. The warning is accurate — it means unreviewed, not unsafe.

### Client type: this is the thing to get right

| | **Vault** (Electron desktop) | **CRM** (Next.js web) |
|---|---|---|
| Client type | **Desktop app** | **Web application** |
| Redirect URI | `http://127.0.0.1:<random port>` — loopback, not registered | A fixed registered URI, e.g. `https://crm.tgagencypro.com/api/drive/callback` |
| Client secret | Required by the token endpoint, but ships with the app — **not** confidential | Genuinely secret — server-side env var only |
| Where tokens live | A file in Electron's `userData` | Server-side, per user, in the database |

**Create a separate Web application client for the CRM.** Reusing the Desktop client will fail with `redirect_uri_mismatch`, and reusing its secret in a web app would be a real leak.

---

## 3. What ports directly

`src/lib/drive.ts` is framework-agnostic and can be copied as-is. It is unit-tested (`drive.test.ts`, 18 cases).

```ts
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Pulls the id out of the several shapes a Drive URL takes:
 *   /drive/folders/<id>            shared folder
 *   /drive/u/0/folders/<id>        multi-account
 *   /file/d/<id>/view              single file
 *   ?id=<id>                       older open?id= links
 */
export function extractDriveId(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of patterns) {
    const m = p.exec(value);
    if (m) return m[1];
  }
  return null;
}

/**
 * Anchored at BOTH ends deliberately. An unanchored match accepts
 * `drive.google.com.evil.test`, which contains the real host as a prefix —
 * the standard lookalike-domain trick. A test caught this.
 */
export const isDriveUrl = (url: string): boolean =>
  /^([a-z0-9-]+\.)*(drive|docs)\.google\.com$/i.test(safeHost(url));

/** Folders first, then files, each alphabetically — how a file browser reads. */
export function sortDriveFiles(files: DriveFile[]): DriveFile[] {
  return [...files].sort((a, b) => {
    const aFolder = a.mimeType === FOLDER_MIME;
    const bFolder = b.mimeType === FOLDER_MIME;
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Escaped so an apostrophe in an id can't break out of the query. */
export function childrenQuery(folderId: string): string {
  const safe = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${safe}' in parents and trashed = false`;
}
```

### The listing call

```
GET https://www.googleapis.com/drive/v3/files
  ?q=<childrenQuery(folderId)>
  &fields=files(id,name,mimeType,webViewLink,iconLink,thumbnailLink,modifiedTime,size)
  &pageSize=200
  &orderBy=folder,name
  &supportsAllDrives=true
  &includeItemsFromAllDrives=true
Authorization: Bearer <access token>
```

`supportsAllDrives` / `includeItemsFromAllDrives` matter if any content lives in a Shared Drive rather than My Drive — without them those folders come back empty with no error.

---

## 4. What does NOT port

### The OAuth dance

The Vault runs a throwaway HTTP server on a random loopback port, opens a Google window, and catches the redirect. **A web app must not do this.** Use the standard server-side code flow:

1. Redirect the user to Google's auth URL with your registered `redirect_uri`
2. Google redirects back to your callback route with `?code=`
3. Exchange it **server-side** for tokens
4. Store tokens against the signed-in CRM user

Keep PKCE — it's cheap and still correct for a web app.

### Secret handling

In the Vault the client secret sits in a per-machine config file, because a desktop client necessarily ships it and Google's docs acknowledge it isn't confidential. **In the CRM it is a real secret**: environment variable, server-side only, never sent to the browser, never committed.

### Token storage and multi-user

The Vault has one user per machine and one token file. The CRM has roles and many users, so:

- Tokens belong to a **user**, not the installation
- Decide deliberately whether VAs get Drive access at all, or whether one agency account is used and shared
- If a shared agency Google account is used, one token set serves everyone — simpler, but every VA sees everything in that Drive

---

## 5. Thumbnails — the part that bit

`thumbnailLink` from the Drive API **requires the Authorization header**. Pointing an `<img src>` straight at it returns **403**. This is the single most time-consuming gotcha here.

- **Vault:** main process fetches with the token and returns a data URL over IPC. Side benefit — the token never reaches the renderer.
- **CRM:** add an API route, e.g. `/api/drive/thumbnail/[fileId]`, that fetches with the server-held token and streams the bytes back. The browser points `<img src>` at *your* route. Never expose the access token to client JS.

Two details worth copying:

- Request a bigger thumbnail: the link ends `=s220`; rewriting to `=s400` gives a usable grid image.
- **Cache, and bound the cache.** Ours is an in-memory `Map` capped at 400 entries. A creator's content folder is large enough that unbounded caching is a leak.

---

## 6. Scope

`https://www.googleapis.com/auth/drive.readonly`

Read-only is deliberate: the app lists and opens files, and cannot modify or delete anything even if it misbehaves. If the CRM later needs to *upload* posted content, that's a scope escalation and a new consent prompt for every user — worth deciding before building, not after.

---

## 7. Mistakes made building this, so you don't repeat them

Every one of these cost a round trip, and all were found by a human clicking, not by tests.

1. **Wrong client type.** Started with *Web application* for a desktop app — random loopback ports can't be registered as redirect URIs.
2. **"No client secret needed."** Google's docs describe the desktop secret as non-confidential, which is true, but their token endpoint still rejects the exchange without it. Error: `client_secret is missing.`
3. **Half-saved config.** An early version stored the client ID before the secret existed. `configured` then read as true and jumped straight to sign-in, skipping the screen that asks for the secret. Validate that *all* required config is present, not just the first field.
4. **Thumbnails via `<img src>`.** 403 every time. See §5.
5. **A picker with nowhere to put its result.** Opened from a context with no target creator, choosing a folder silently did nothing. If a picker can be opened from two places, make the destination an explicit prop.
6. **Unanchored host check.** `drive.google.com.evil.test` passed as a Drive URL. Anchor both ends.

---

## 8. Files in the Vault, for reference

| File | Contains |
|---|---|
| `src/lib/drive.ts` | Pure logic — URL parsing, sorting, query building. **Ports directly.** |
| `src/lib/drive.test.ts` | 18 unit tests for the above |
| `src/driveAuth.ts` | Desktop OAuth: PKCE, loopback server, token file. **Does not port.** |
| `src/main.ts` | IPC handlers: status, sign-in, list, thumbnail proxy |
| `src/views/drive/DriveView.tsx` | Browser UI — breadcrumbs, grid/list toggle |
| `src/views/drive/DriveTile.tsx` | Thumbnail tile with async fetch |
| `src/views/dossier/DrivePicker.tsx` | Setup wizard + folder picker modal |

The UI components are plain React and mostly portable; only the `window.vaultBridge.*` calls need swapping for `fetch('/api/drive/...')`.
