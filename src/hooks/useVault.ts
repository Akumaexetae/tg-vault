import { useCallback, useEffect, useRef, useState } from 'react';
import { isConfigured } from '../config';
import { fetchAll } from '../lib/queries';
import { supabase } from '../lib/supabase';
import type { VaultData } from '../lib/types';

export type VaultStatus = 'loading' | 'online' | 'offline' | 'unconfigured';

export interface VaultState {
  data: VaultData | null;
  status: VaultStatus;
  refresh: () => Promise<void>;
}

export function useVault(): VaultState {
  const [data, setData] = useState<VaultData | null>(null);
  const [status, setStatus] = useState<VaultStatus>('loading');
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (!isConfigured()) {
      setStatus('unconfigured');
      return;
    }
    if (loading.current) return;
    loading.current = true;
    try {
      const fresh = await fetchAll();
      setData(fresh);
      setStatus('online');
      window.vaultBridge?.saveCache(JSON.stringify(fresh)).catch(() => {});
    } catch {
      // Supabase unreachable — fall back to the last synced snapshot.
      const cached = await window.vaultBridge
        ?.loadCache()
        .catch((): string | null => null);
      if (cached) {
        try {
          setData(JSON.parse(cached) as VaultData);
        } catch {
          /* corrupt cache — keep whatever we have */
        }
      }
      setStatus('offline');
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!isConfigured()) return;

    const channel = supabase
      .channel('vault-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creators' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, () => refresh())
      .subscribe();

    // Safety net: realtime can silently drop; refetch every 60s.
    const poll = setInterval(refresh, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [refresh]);

  return { data, status, refresh };
}
