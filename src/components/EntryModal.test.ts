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

describe('extractSecret — the format authenticator apps display', () => {
  it('strips the groups-of-four spacing Instagram and Google show', () => {
    expect(extractSecret('JBSW Y3DP EHPK 3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uppercases, since base32 is case-insensitive but decoders are not', () => {
    expect(extractSecret('jbswy3dpehpk3pxp')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('strips dashes, which some sites use instead of spaces', () => {
    expect(extractSecret('JBSW-Y3DP-EHPK-3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('normalises a secret pulled out of an otpauth link too', () => {
    expect(
      extractSecret('otpauth://totp/Acme:bob?secret=jbswy3dp%20ehpk3pxp&issuer=Acme'),
    ).toBe('JBSWY3DPEHPK3PXP');
  });

  it('leaves an already-clean secret alone', () => {
    expect(extractSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });
});
