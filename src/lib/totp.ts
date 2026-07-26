import * as OTPAuth from 'otpauth';

export interface TotpResult {
  code: string;
  secondsLeft: number;
}

/** Live 6-digit TOTP code for a base32 secret, or null if the secret is invalid. */
export function totpCode(
  secret: string,
  timestamp: number = Date.now(),
): TotpResult | null {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(
        secret.replace(/[\s-]/g, '').toUpperCase(),
      ),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    return {
      code: totp.generate({ timestamp }),
      secondsLeft: 30 - (Math.floor(timestamp / 1000) % 30),
    };
  } catch {
    return null;
  }
}
