import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeUrl,
  saveConnection,
  validateConnection,
  type Connection,
} from '../lib/settings';

/**
 * First-launch setup. The vault's address and key are entered here rather than
 * compiled in, so the published app contains no secret.
 */
export function ConnectScreen({ onConnected }: { onConnected: (c: Connection) => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const connect = async () => {
    const cleanUrl = normalizeUrl(url);
    const cleanKey = key.trim();
    const invalid = validateConnection(cleanUrl, cleanKey);
    if (invalid) {
      setError(invalid);
      return;
    }
    setTesting(true);
    setError('');
    try {
      // Prove the pair works before storing it — a typo here is confusing later.
      const probe = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false },
      });
      const { error: probeError } = await probe.from('creators').select('id').limit(1);
      if (probeError) throw probeError;
      const connection = { url: cleanUrl, key: cleanKey };
      saveConnection(connection);
      onConnected(connection);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't reach the vault: ${e.message}`
          : "Couldn't reach the vault — check the URL and key.",
      );
      setTesting(false);
    }
  };

  return (
    <div className="identity-screen">
      <div className="identity-card setup-card">
        <div className="identity-logo">T&amp;G Vault</div>
        <p className="identity-sub">
          Connect this PC to your vault. You only do this once — ask Tyler for these
          two values.
        </p>

        <label className="form-label">Vault URL</label>
        <input
          className="input"
          placeholder="https://yourproject.supabase.co"
          value={url}
          autoFocus
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && connect()}
        />

        <label className="form-label">Vault key</label>
        <input
          className="input"
          placeholder="sb_publishable_… or eyJ…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && connect()}
        />

        {error && <div className="form-error connect-error">{error}</div>}

        <button
          className="btn btn-primary connect-btn"
          disabled={testing}
          onClick={connect}
        >
          {testing ? 'Connecting…' : 'Connect'}
        </button>

        <p className="connect-hint">
          Stored on this PC only — it is never included in the app itself.
        </p>
      </div>
    </div>
  );
}
