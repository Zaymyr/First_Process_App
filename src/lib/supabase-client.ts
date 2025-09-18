'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Nous avons migré sur flowType 'implicit'. Les anciens liens d'invitation PKCE contiennent ?code=...
  // Supabase JS tente alors un échange /auth/v1/token?grant_type=pkce qui échoue (400) car aucun code_verifier n'a été stocké.
  // Pour éviter ce bruit (et potentiels effets de bord), on retire le param 'code' quand il est seul sans tokens implicites.
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      const hasCode = url.searchParams.has('code');
      const hasImplicitTokens = url.searchParams.has('access_token') || url.searchParams.has('refresh_token') || url.hash.includes('access_token=');
      if (hasCode && !hasImplicitTokens) {
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.toString());
        // Log discret pour debug (peut être retiré plus tard)
        // eslint-disable-next-line no-console
        console.info('[supabase-client] Paramètre ?code retiré (ancien lien PKCE)');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[supabase-client] Sanitation code param échouée', e);
    }
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,        // keep session in localStorage
        detectSessionInUrl: true,    // parse tokens on redirect
  flowType: 'implicit',        // implicit: évite dépendance au code_verifier pour liens email (invite/magic)
      }
    }
  );
}
