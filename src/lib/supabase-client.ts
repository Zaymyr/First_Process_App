'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,        // keep session in localStorage
        detectSessionInUrl: true,    // parse tokens on redirect
        flowType: 'pkce',            // align with recovery links that use PKCE
      }
    }
  );
}
