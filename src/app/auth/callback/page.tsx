// src/app/auth/callback/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const supabase = createClient();

      const url = new URL(window.location.href);
      const nextUrl = params.get('next') || '/';

      const token = params.get('token');          // recovery / magiclink token-hash flow
      const type  = params.get('type');           // 'magiclink' | 'recovery' | 'email'
      const code  = params.get('code');           // PKCE flow

      try {
        // Déjà connecté ? On va directement vers nextUrl
        const s0 = await supabase.auth.getSession();
        if (s0.data.session) {
          router.replace(nextUrl);
          return;
        }

        if (token && type) {
          // Vérifie le token et crée la session (recovery ou magiclink)
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'magiclink' | 'recovery' | 'email',
          });
          if (error) throw error;
        } else if (code) {
          // Échange le code PKCE contre une session
          const { error } = await supabase.auth.exchangeCodeForSession(url.toString());
          if (error) throw error;
        } else {
          // Pas de paramètres valides : on retourne à /login
          router.replace('/login');
          return;
        }

        // Attendre que la session soit bien disponible (persistance navigateur)
        for (let i = 0; i < 12; i++) {
          const s = await supabase.auth.getSession();
          if (s.data.session) {
            router.replace(nextUrl);
            return;
          }
          await new Promise(r => setTimeout(r, 150));
        }

        // Si on arrive ici, la session n'a pas été stockée
        console.error('[callback] session not found after login — check port 3000 is Public and URL config');
        alert('Signed in, but session not stored. Check Codespaces port 3000 is Public and Supabase redirect URLs match exactly.');
        router.replace('/');
      } catch (err) {
        console.error('[callback] error', err);
        router.replace('/login');
      }
    })();
  }, [router, params]);

  return <p>Signing you in…</p>;
}
