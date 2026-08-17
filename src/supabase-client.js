import { createClient } from '@supabase/supabase-js';
import { createSupabaseConfig } from './config.js';

let client;

export function getSupabaseClient() {
  if (!client) {
    const { url, anonKey } = createSupabaseConfig();
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return client;
}

export function resetSupabaseClientForTests() {
  client = undefined;
}
