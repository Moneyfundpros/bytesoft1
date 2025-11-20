import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase helper.
// Expects the following env vars populated in `.env.local`:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Keep this non-throwing for builds, but warn developers.
  // eslint-disable-next-line no-console
  console.warn('Supabase keys are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

export default supabase;
