import { useEffect, useState } from 'react';
import { totpCode, type TotpResult } from '../lib/totp';

/** Live TOTP code for a secret, ticking every second. Null if no/invalid secret. */
export function useTotp(secret: string | null): TotpResult | null {
  const [result, setResult] = useState<TotpResult | null>(() =>
    secret ? totpCode(secret) : null,
  );

  useEffect(() => {
    if (!secret) {
      setResult(null);
      return;
    }
    setResult(totpCode(secret));
    const timer = setInterval(() => setResult(totpCode(secret)), 1000);
    return () => clearInterval(timer);
  }, [secret]);

  return result;
}
