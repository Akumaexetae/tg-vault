import { describe, expect, it } from 'vitest';
import { allTags, hasTag, normalizeTag, normalizeTags, parseTags } from './tags';

describe('normalizeTag', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTag('  USA  ')).toBe('USA');
    expect(normalizeTag('do   not   post')).toBe('do not post');
  });

  it('strips commas, which separate tags when typing', () => {
    expect(normalizeTag('USA,')).toBe('USA');
  });

  it('is empty for an unusable tag, so callers can drop it', () => {
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag(',')).toBe('');
  });

  it('truncates a tag long enough to wreck the row', () => {
    expect(normalizeTag('a'.repeat(40))).toHaveLength(24);
  });
});

describe('normalizeTags', () => {
  it('drops duplicates case-insensitively, keeping the first spelling', () => {
    expect(normalizeTags(['USA', 'usa', 'Usa'])).toEqual(['USA']);
  });

  it('drops empties', () => {
    expect(normalizeTags(['USA', '  ', ''])).toEqual(['USA']);
  });

  it('keeps distinct tags in the order given', () => {
    expect(normalizeTags(['warmed', 'USA'])).toEqual(['warmed', 'USA']);
  });
});

describe('parseTags', () => {
  it('splits on commas', () => {
    expect(parseTags('USA, warmed,  aged ')).toEqual(['USA', 'warmed', 'aged']);
  });

  it('handles a single tag and trailing separators', () => {
    expect(parseTags('USA')).toEqual(['USA']);
    expect(parseTags('USA,,')).toEqual(['USA']);
  });
});

describe('allTags', () => {
  it('collects every tag in use, alphabetically, without duplicates', () => {
    expect(
      allTags([{ tags: ['USA', 'warmed'] }, { tags: ['usa', 'aged'] }, {}]),
    ).toEqual(['aged', 'USA', 'warmed']);
  });
});

describe('hasTag', () => {
  it('matches regardless of case', () => {
    expect(hasTag({ tags: ['USA'] }, 'usa')).toBe(true);
    expect(hasTag({ tags: ['USA'] }, 'UK')).toBe(false);
    expect(hasTag({}, 'USA')).toBe(false);
  });
});
