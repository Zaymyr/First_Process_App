// src/app/accept-invite/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

type Phase = 'checking' | 'need-session' | 'accepting' | 'done' | 'error';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get('inviteId') ?? '';
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>('checking');
  const [msg, setMsg] = useState<string>('Finishing your invite…');

  // 1) If Supabase sent implicit tokens in the URL fragment, bounce through /auth/callback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (location.hash && location.hash.startsWith('#access_token')) {
      const frag = new URLSearchParams(location.hash.slice(1));
      const q = new URLSearchParams();
      q.set('next', `/accept-invite?inviteId=${inviteId}`);
      for (const key of [
        'access_token',
        'refresh_token',
        'expires_in',
        'expires_at',
        'token_type',
        'type',
        'provider_token',
      ]) {
        const v = frag.get(key);
        if (v) q.set(key, v);
      }
      location.replace(`/auth/callback?${q.toString()}`);
    }
  }, [inviteId]);

  // 2) Wait for a valid session; once we have one, accept automatically
  useEffect(() => {
    let tries = 0;
    let stop = false;

    const acceptIfReady = async () => {
      const { data } = await supabase.auth.getSession();
      if (stop) return;

      if (data.session) {
        try {
          setPhase('accepting');
          const resp = await fetch('/api/invites/accept', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ inviteId }),
          });
          const j = await resp.json();
          if (!resp.ok) {
            setMsg(j?.error || 'Failed to accept invite.');
            setPhase('error');
            return;
          }
          setPhase('done');
          router.replace('/org?toast=' + encodeURIComponent('Bienvenue ! Vous avez rejoint l’organisation.') + '&kind=success');
        } catch (err: any) {
          setMsg(err?.message || 'Unexpected error.');
          setPhase('error');
        }
        return;
      }

      if (tries++ < 20) {
        setTimeout(acceptIfReady, 500);
      } else {
        setPhase('need-session');
        setMsg('Session introuvable. Cliquez à nouveau sur le lien d’invitation ou connectez-vous.');
      }
    };

    if (inviteId) acceptIfReady();
    return () => { stop = true; };
  }, [inviteId, supabase, router]);

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
      <h2>Finalisation de l’invitation…</h2>
      {phase === 'checking' && <p>Vérification de la session…</p>}
      {phase === 'need-session' && (
        <>
          <p style={{ color: 'crimson' }}>{msg}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/login?next=/accept-invite">Se connecter manuellement</a>
            <button onClick={() => location.reload()}>Réessayer</button>
          </div>
        </>
      )}
      {phase === 'accepting' && <p>Acceptation de l’invitation…</p>}
      {phase === 'done' && <p>Terminé — redirection…</p>}
      {phase === 'error' && <p style={{ color: 'crimson' }}>{msg}</p>}
    </section>
  );
}
