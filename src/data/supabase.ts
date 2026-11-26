import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

export const supabase: SupabaseClient | null = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Varmistaa, että laitteella on anonyymi istunto. Palauttaa käyttäjän id:n. */
export async function ensureSession(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await client.auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error('Anonyymi kirjautuminen epäonnistui');
  return signed.user.id;
}
