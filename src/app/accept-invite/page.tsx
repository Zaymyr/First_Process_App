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
  const urlError = params.get('error') ?? '';
  const urlErrorCode = params.get('error_code') ?? '';
  const alreadySynced = params.get('synced') === '1';
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>('checking');
  const [msg, setMsg] = useState<string>('');
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

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

    // Case C: Supabase magic link / invite with token hash (?token=...&type=signup|magiclink|recovery|email_change)
    const hasOtpToken = url.searchParams.has('token') && url.searchParams.has('type');
    if (hasOtpToken) {
      const token = url.searchParams.get('token')!;
      const type = url.searchParams.get('type')! as
        | 'signup'
        | 'magiclink'
        | 'recovery'
        | 'email_change';
      // Nettoie immédiatement l'URL visible
      window.history.replaceState({}, '', `/accept-invite?inviteId=${inviteId}`);
      (async () => {
        try {
          // Vérifie l'OTP pour créer la session côté client
          await supabase.auth.verifyOtp({ token_hash: token, type });
          // Synchronise les cookies serveur via /auth/callback en passant les tokens actuels
          const cur = await supabase.auth.getSession();
          const at = cur.data.session?.access_token;
          const rt = (cur.data.session as any)?.refresh_token;
          if (at && rt) {
            const next = `/accept-invite?inviteId=${encodeURIComponent(inviteId)}&synced=1`;
            const q = new URLSearchParams({ access_token: at, refresh_token: rt, next });
            location.replace(`/auth/callback?${q.toString()}`);
          }
        } catch (e) {
          // En cas d'échec (lien expiré ou invalide)
          const next = new URL(`/accept-invite?inviteId=${inviteId}`, location.origin);
          next.searchParams.set('error', 'access_denied');
          next.searchParams.set('error_code', 'otp_expired');
          location.replace(next.toString());
        }
      })();
      return;
    }
  }, [inviteId]);

  // 2) Lire la session; si déjà connecté on saute le set password
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const u = data.session?.user;
      setEmail(u?.email ?? null);
      if (u) {
        // Si l'utilisateur est connecté côté client mais que les cookies serveur ne sont pas encore en place,
        // on force une synchro via /auth/callback (une seule fois grâce au flag synced=1).
        if (!alreadySynced) {
          try {
            const fresh = await supabase.auth.getSession();
            const at = fresh.data.session?.access_token;
            const rt = (fresh.data.session as any)?.refresh_token;
            if (at && rt) {
              const next = `/accept-invite?inviteId=${encodeURIComponent(inviteId)}&synced=1`;
              const q = new URLSearchParams({ access_token: at, refresh_token: rt, next });
              location.replace(`/auth/callback?${q.toString()}`);
              return; // attend la redirection
            }
          } catch {
            // ignore et on tente quand même d'accepter
          }
        }
        setPhase('accepting');
        await acceptInvite();
      } else {
        // Si nous n'avons pas de session et que l'URL indique un lien expiré, on guide le renvoi du lien
        if ((urlError && urlError !== 'null') || urlErrorCode === 'otp_expired') {
          setMsg('Votre lien a expiré ou est invalide. Renvoyez un nouveau lien de réinitialisation.');
          setPhase('error');
        } else {
          // Pas de session et pas d’erreur explicite -> inviter à repasser par l’email ou à se connecter
          setMsg('Vous devez ouvrir le lien depuis l’email reçu (ou vous connecter) pour finaliser l’invitation.');
          setPhase('need-session');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, alreadySynced, inviteId, urlError, urlErrorCode]);

  async function acceptInvite() {
    setPhase('accepting');
    // Joindre le token d'accès en Bearer en fallback si les cookies serveur ne sont pas encore synchronisés
    const cur = await supabase.auth.getSession();
    const at = cur.data.session?.access_token;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (at) headers['authorization'] = `Bearer ${at}`;
    const resp = await fetch('/api/invites/accept', {
      method: 'POST',
      headers,
      body: JSON.stringify({ inviteId }),
    });
    const j = await resp.json();
    if (!resp.ok) {
      // Si 401, on essaie une synchronisation des cookies serveur et on relance le flux.
      if (resp.status === 401) {
        try {
          const cur = await supabase.auth.getSession();
          const at = cur.data.session?.access_token;
          const rt = (cur.data.session as any)?.refresh_token;
          if (at && rt && !alreadySynced) {
            const next = `/accept-invite?inviteId=${encodeURIComponent(inviteId)}&synced=1`;
            const q = new URLSearchParams({ access_token: at, refresh_token: rt, next });
            location.replace(`/auth/callback?${q.toString()}`);
            return;
          }
        } catch {
          // ignore
        }
      }
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
      const cur = await supabase.auth.getSession();
      const at = cur.data.session?.access_token;
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (at) headers['authorization'] = `Bearer ${at}`;
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password })
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || 'Impossible de définir le mot de passe.');
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

  async function resendResetFromClient() {
    try {
      setBusy(true);
      setResetSent(false);
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${base}/accept-invite?inviteId=${encodeURIComponent(inviteId)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo });
      if (error) {
        setMsg(error.message);
        setResetSent(false);
        return;
      }
      setResetSent(true);
      setMsg('Un nouveau lien vient d\'être envoyé. Consultez vos emails et cliquez sur le lien le plus récent.');
    } catch (e: any) {
      setMsg(e?.message || 'Échec de l\'envoi du lien.');
    } finally {
      setBusy(false);
    }
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
      {phase === 'error' && (urlErrorCode === 'otp_expired' || (urlError && urlError !== 'null')) && (
        <div style={{ display: 'grid', gap: 8 }}>
          <label>
            Votre email
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="votre@email.com"
              required
            />
          </label>
          <button type="button" disabled={busy || !resetEmail} onClick={resendResetFromClient}>
            {busy ? 'Envoi…' : 'Renvoyer un lien de réinitialisation'}
          </button>
          {resetSent && <p style={{ color: 'green' }}>Lien envoyé. Ouvrez l\'email le plus récent puis revenez ici.</p>}
        </div>
      )}
    </section>
  );
}
