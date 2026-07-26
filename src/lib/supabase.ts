import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConnection } from './settings';

let client: SupabaseClient | null = null;
let clientUrl = '';

/**
 * Supabase client built from the connection this machine was set up with.
 * Rebuilt automatically if the stored connection changes.
 */
export function getClient(): SupabaseClient {
  const connection = loadConnection();
  if (!connection) {
    throw new Error('Vault is not connected yet.');
  }
  if (!client || clientUrl !== connection.url) {
    client = createClient(connection.url, connection.key, {
      auth: { persistSession: false },
    });
    clientUrl = connection.url;
  }
  return client;
}

export function resetClient(): void {
  client = null;
  clientUrl = '';
}
