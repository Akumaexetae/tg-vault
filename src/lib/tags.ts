/**
 * Free-form labels on an account.
 *
 * Deliberately light: no catalogue, no validation beyond tidying. The pills
 * already on a row are derived from the data; these are the ones a person adds
 * because the data cannot know them — "USA", "warmed", "do not post".
 */

/** Longer than this is a note, not a label, and it wrecks the row layout. */
export const MAX_TAG_LENGTH = 24;

/**
 * Tidies one tag. Returns '' for anything unusable, so callers can drop it.
 * Commas are stripped because they are the separator when typing several.
 */
export function normalizeTag(input: string): string {
  return input.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
}

/**
 * Cleans a whole list: tidies each, drops empties, and removes duplicates
 * case-insensitively while keeping the first spelling the user chose — so
 * "USA" and "usa" cannot both appear, but their capitals are respected.
 */
export function normalizeTags(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Splits what someone typed into tags. Comma or Enter both separate. */
export function parseTags(input: string): string[] {
  return normalizeTags(input.split(','));
}

/** Every tag in use, for suggesting what already exists. Alphabetical. */
export function allTags(entries: readonly { tags?: string[] }[]): string[] {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive, because nobody types labels consistently. */
export function hasTag(entry: { tags?: string[] }, tag: string): boolean {
  const target = tag.toLowerCase();
  return (entry.tags ?? []).some((t) => t.toLowerCase() === target);
}
