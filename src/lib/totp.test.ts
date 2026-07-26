import { describe, expect, it } from 'vitest';
import { totpCode } from './totp';

// RFC 6238 test vector: ASCII secret "12345678901234567890" in base32,
// SHA-1, T=59s → 8-digit code 94287082 → 6-digit truncation 287082.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totpCode', () => {
  it('matches the RFC 6238 SHA-1 test vector at T=59s', () => {
    const result = totpCode(RFC_SECRET, 59_000);
    expect(result?.code).toBe('287082');
  });

  it('reports seconds left in the 30s window', () => {
    expect(totpCode(RFC_SECRET, 0)?.secondsLeft).toBe(30);
    expect(totpCode(RFC_SECRET, 29_000)?.secondsLeft).toBe(1);
  });

  it('tolerates lowercase and spaced secrets', () => {
    const spaced = 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq';
    expect(totpCode(spaced, 59_000)?.code).toBe('287082');
  });

  it('returns null for an invalid secret', () => {
    expect(totpCode('not base32 !!!', 59_000)).toBeNull();
  });
});
