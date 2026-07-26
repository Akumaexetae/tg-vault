// Supabase project credentials.
// Fill these in from your Supabase project: Settings → API.
// Both installs (Tyler + Gabriel) ship the same values.
export const SUPABASE_URL = 'https://bwzrtosxnlxeqpnbwjjq.supabase.co';
export const SUPABASE_ANON_KEY =
  'sb_publishable_OdCcx1UUPSxQ-YsMx3BqFg_19tM8CDX';

export const isConfigured = (): boolean =>
  !SUPABASE_URL.includes('YOUR-PROJECT') &&
  !SUPABASE_ANON_KEY.startsWith('YOUR-');
