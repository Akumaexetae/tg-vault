import { describe, expect, it } from 'vitest';
import { instagramHandle, instagramProfileUrl, isInstagram } from './instagram';

describe('isInstagram', () => {
  it('matches regardless of case', () => {
    expect(isInstagram('instagram')).toBe(true);
    expect(isInstagram('Instagram')).toBe(true);
    expect(isInstagram('onlyfans')).toBe(false);
  });
});

describe('instagramHandle', () => {
  it('accepts a plain handle', () => {
    expect(instagramHandle('lola.ellaaa')).toBe('lola.ellaaa');
    expect(instagramHandle('rvr_lolaaa8')).toBe('rvr_lolaaa8');
  });

  it('strips a leading @ and surrounding spaces', () => {
    expect(instagramHandle('  @exerpo.lola ')).toBe('exerpo.lola');
  });

  it('pulls the handle out of a pasted profile URL', () => {
    expect(instagramHandle('https://www.instagram.com/lola.hiell/')).toBe('lola.hiell');
    expect(instagramHandle('instagram.com/lola.joyaa?hl=en')).toBe('lola.joyaa');
  });

  it('refuses an email, which would build a link that 404s', () => {
    expect(instagramHandle('lola@gmail.com')).toBeNull();
  });

  it('refuses empty or malformed values', () => {
    expect(instagramHandle('')).toBeNull();
    expect(instagramHandle('   ')).toBeNull();
    // 'a b' now yields 'a': a trailing word is treated as a label, which is
    // what makes "rivera.lo08 FLASH" work. Only a malformed FIRST token fails.
    expect(instagramHandle('!!! ???')).toBeNull();
    expect(instagramHandle('a'.repeat(31))).toBeNull();
  });
});

describe('instagramProfileUrl', () => {
  it('builds a profile link from a handle', () => {
    expect(instagramProfileUrl('lola.nina08')).toBe('https://www.instagram.com/lola.nina08/');
  });

  it('is null when there is no usable handle', () => {
    expect(instagramProfileUrl('someone@example.com')).toBeNull();
  });
});

describe('usernames carrying a label', () => {
  it('ignores a trailing tag like FLASH', () => {
    expect(instagramHandle('rivera.lo08 FLASH')).toBe('rivera.lo08');
    expect(instagramHandle('quinlolaaa FLASH')).toBe('quinlolaaa');
    expect(instagramProfileUrl('riva08lola FLASH')).toBe(
      'https://www.instagram.com/riva08lola/',
    );
  });

  it('still rejects a labelled email', () => {
    expect(instagramHandle('lola@gmail.com FLASH')).toBeNull();
  });

  it('handles an @ prefix and a label together', () => {
    expect(instagramHandle('@pradalolaaa FLASH')).toBe('pradalolaaa');
  });
});
