import { describe, expect, it } from 'vitest';
import { normalizeUrl, validateConnection } from './settings';

describe('normalizeUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co');
  });

  it('strips a pasted /rest/v1 suffix', () => {
    expect(normalizeUrl('https://abc.supabase.co/rest/v1/')).toBe(
      'https://abc.supabase.co',
    );
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  https://abc.supabase.co  ')).toBe('https://abc.supabase.co');
  });
});

describe('validateConnection', () => {
  const key = 'sb_publishable_abcdefghijklmnop';

  it('accepts a well-formed pair', () => {
    expect(validateConnection('https://abc.supabase.co', key)).toBeNull();
  });

  it('accepts a URL that needed normalizing', () => {
    expect(validateConnection('https://abc.supabase.co/rest/v1/', key)).toBeNull();
  });

  it('rejects a non-Supabase URL', () => {
    expect(validateConnection('https://example.com', key)).toMatch(/supabase\.co/);
  });

  it('rejects a short key', () => {
    expect(validateConnection('https://abc.supabase.co', 'nope')).toMatch(/too short/);
  });
});
