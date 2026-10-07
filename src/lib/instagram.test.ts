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
    expect(instagramHandle('has spaces')).toBeNull();
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
