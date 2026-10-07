/**
 * Turning a vault entry into a viewable Instagram profile.
 *
 * The username field is whatever was typed when the account was saved, so it
 * is usually a handle but can be an email, a handle with a leading @, or a
 * pasted profile URL. Only a real handle can become a profile link.
 */

/** Instagram handles: letters, digits, dots and underscores, max 30. */
const HANDLE = /^[a-zA-Z0-9._]{1,30}$/;

export function isInstagram(serviceKey: string): boolean {
  return serviceKey.toLowerCase() === 'instagram';
}

/**
 * The handle for an entry, or null when the username cannot be one — an email
 * address, for instance, which would otherwise produce a profile link that
 * 404s and looks like the account is gone.
 */
export function instagramHandle(username: string): string | null {
  let value = username.trim();
  if (!value) return null;

  // A pasted profile URL: take the first path segment.
  const url = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(value);
  if (url) value = url[1];

  if (value.startsWith('@')) value = value.slice(1);
  if (value.includes('@')) return null; // an email, not a handle
  return HANDLE.test(value) ? value : null;
}

/** Profile URL for an entry, or null when there is no usable handle. */
export function instagramProfileUrl(username: string): string | null {
  const handle = instagramHandle(username);
  return handle ? `https://www.instagram.com/${handle}/` : null;
}
