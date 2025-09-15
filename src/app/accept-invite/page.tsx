// src/app/accept-invite/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

type Phase = 'checking' | 'need-session' | 'password' | 'accepting' | 'done' | 'error';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get('inviteId') ?? '';
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>('checking');
  const [msg, setMsg] = useState<string>('Finishing your invite…');
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  // 1) If Supabase sent tokens (hash or query) or a PKCE code, bounce through /auth/callback
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Case A: tokens in URL fragment (#access_token)
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
      return;
    }

    // Case B: PKCE code in query, or tokens provided in query
    const url = new URL(location.href);
    const hasCode = url.searchParams.has('code');
    const hasTokensInQuery = url.searchParams.has('access_token') && url.searchParams.has('refresh_token');
    if (hasCode || hasTokensInQuery) {
      const q = new URLSearchParams(url.search);
      q.set('next', `/accept-invite?inviteId=${inviteId}`);
      // Nettoie l'URL courante pour éviter clignotement et boucles
      window.history.replaceState({}, '', `/accept-invite?inviteId=${inviteId}`);
      location.assign(`/auth/callback?${q.toString()}`);
      return;
    }
  }, [inviteId]);

  // 2) Wait for a valid session; once we have one, montrer le formulaire
  useEffect(() => {
  let tries = 0;
    let stop = false;

    const acceptIfReady = async () => {
      const { data } = await supabase.auth.getSession();
      if (stop) return;

      if (data.session) {
        const u = data.session.user;
        setEmail(u?.email ?? null);
        setPhase('password');
        return;
      }

      if (tries++ < 10) {
        setTimeout(acceptIfReady, 300);
      } else {
        setPhase('need-session');
        setMsg('Session introuvable. Cliquez à nouveau sur le lien d’invitation ou connectez-vous.');
      }
    };

    if (inviteId) acceptIfReady();
    return () => { stop = true; };
  }, [inviteId, supabase, router]);

  async function acceptInvite() {
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
  }

  async function onSetPasswordAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteId) return;
    if (!password || password !== confirm) {
      setMsg('Les mots de passe ne correspondent pas.');
      setPhase('error');
      return;
    }
    try {
      setBusy(true);
      setMsg('Définition du mot de passe…');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMsg(error.message);
        setPhase('error');
        setBusy(false);
        return;
      }
      await acceptInvite();
    } catch (err: any) {
      setMsg(err?.message || 'Erreur inattendue.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  async function onSkipAndAccept() {
    if (!inviteId) return;
    await acceptInvite();
  }

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
      <h2>Finalisation de l’invitation…</h2>
      {phase === 'checking' && <p>Vérification de la session…</p>}
      {phase === 'need-session' && (
        <>
          <p style={{ color: 'crimson' }}>{msg}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/login?next=${encodeURIComponent('/accept-invite?inviteId=' + inviteId)}`}>Se connecter manuellement</a>
            <button onClick={() => location.reload()}>Réessayer</button>
          </div>
        </>
      )}
      {phase === 'password' && (
        <>
          <p>{email ? `Bonjour ${email}, définissez un mot de passe pour finaliser.` : 'Définissez un mot de passe pour finaliser.'}</p>
          <form onSubmit={onSetPasswordAndAccept} style={{ display: 'grid', gap: 8 }}>
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Confirmer le mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>{busy ? 'Travail…' : 'Définir le mot de passe et rejoindre'}</button>
              <button type="button" onClick={onSkipAndAccept} disabled={busy}>Continuer sans définir de mot de passe</button>
            </div>
          </form>
        </>
      )}
      {phase === 'accepting' && <p>Acceptation de l’invitation…</p>}
      {phase === 'done' && <p>Terminé — redirection…</p>}
      {phase === 'error' && <p style={{ color: 'crimson' }}>{msg}</p>}
    </section>
  );
}
