// Supabase project credentials.
// Fill these in from your Supabase project: Settings → API.
// Both installs (Tyler + Gabriel) ship the same values.
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

export const isConfigured = (): boolean =>
  !SUPABASE_URL.includes('YOUR-PROJECT') &&
  !SUPABASE_ANON_KEY.startsWith('YOUR-');
