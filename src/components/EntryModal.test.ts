import { describe, expect, it } from 'vitest';
import { extractSecret } from './EntryModal';

describe('extractSecret', () => {
  it('pulls the secret out of an otpauth:// URI', () => {
    expect(
      extractSecret(
        'otpauth://totp/OnlyFans:bella?secret=JBSWY3DPEHPK3PXP&issuer=OnlyFans',
      ),
    ).toBe('JBSWY3DPEHPK3PXP');
  });

  it('url-decodes the secret', () => {
    expect(extractSecret('otpauth://totp/x?secret=ABC%3DDEF')).toBe('ABC=DEF');
  });

  it('passes a plain base32 secret through untouched', () => {
    expect(extractSecret('  JBSWY3DPEHPK3PXP ')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('leaves an otpauth link with no secret param alone', () => {
    expect(extractSecret('otpauth://totp/x?issuer=y')).toBe('otpauth://totp/x?issuer=y');
  });
});
