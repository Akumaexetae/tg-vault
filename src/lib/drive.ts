export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
}

export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Pulls the id out of the several shapes a Drive URL takes:
 *   /drive/folders/<id>            shared folder
 *   /drive/u/0/folders/<id>        multi-account
 *   /file/d/<id>/view              single file
 *   ?id=<id>                       older open?id= links
 * Returns null for anything that isn't a Drive link.
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
 * Anchored at BOTH ends deliberately. An unanchored match would accept
 * `drive.google.com.evil.test`, which contains the real host as a prefix —
 * the standard lookalike-domain trick.
 */
export const isDriveUrl = (url: string): boolean =>
  /^([a-z0-9-]+\.)*(drive|docs)\.google\.com$/i.test(safeHost(url));

function safeHost(url: string): string {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return '';
  }
}

export const folderUrl = (id: string): string =>
  `https://drive.google.com/drive/folders/${id}`;

/** True when the token is missing or within `skewSeconds` of expiring. */
export function needsRefresh(
  expiresAt: number | null,
  now = Date.now(),
  skewSeconds = 60,
): boolean {
  if (!expiresAt) return true;
  return now >= expiresAt - skewSeconds * 1000;
}

/** Folders first, then files, each alphabetically — how a file browser reads. */
export function sortDriveFiles(files: DriveFile[]): DriveFile[] {
  return [...files].sort((a, b) => {
    const aFolder = a.mimeType === FOLDER_MIME;
    const bFolder = b.mimeType === FOLDER_MIME;
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * A Drive query listing the children of a folder, with the quoting Drive's
 * API requires — an unescaped apostrophe in a folder id would otherwise break
 * the query.
 */
export function childrenQuery(folderId: string): string {
  const safe = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${safe}' in parents and trashed = false`;
}
