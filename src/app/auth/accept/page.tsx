"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

/*
  Page unique d'atterrissage pour tous les liens Supabase (invite, signup, recovery, magic link).

  Paramètres possibles dans l'URL après redirection Supabase:
    - token & type (invite | signup | recovery)
    - code (PKCE)
    - access_token / refresh_token (implicit)
    - inviteId (notre id interne)
    - em (email attendu)

  Comportement:
    1. Établir une session si nécessaire (exchangeCodeForSession, verifyOtp, setSession).
    2. Vérifier cohérence email session vs em.
    3. Si pas de mot de passe (user_metadata.has_password != true) => afficher formulaire de définition.
    4. Après définition mdp: appeler /api/auth/password puis /api/invites/accept (si inviteId) puis rediriger /org.
    5. Si mot de passe existe déjà: accepter l'invite directement (si inviteId) et rediriger /org.
*/
export default function AcceptPage() {
  const supabase = useMemo(() => createClient(), []);
  const sp = useSearchParams();
  const router = useRouter();

  const inviteId = sp.get('inviteId') || '';
  const expectedEmail = (sp.get('em') || '').toLowerCase();
  const token = sp.get('token');
  const type = sp.get('type');
  const code = sp.get('code'); // Cas résiduel PKCE (legacy)
  const access_token = sp.get('access_token');
  const refresh_token = sp.get('refresh_token');

  // Tokens éventuellement dans le fragment (#access_token=...) pour implicit/magic link.
  const [fragmentTokens, setFragmentTokens] = useState<{ access_token?: string; refresh_token?: string } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (fragmentTokens) return; // déjà extrait
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const at = params.get('access_token') || undefined;
      const rt = params.get('refresh_token') || undefined;
      if (at) {
        setFragmentTokens({ access_token: at, refresh_token: rt });
        const clean = new URL(window.location.href);
        clean.hash = '';
        window.history.replaceState({}, '', clean.toString());
      }
    }
  }, [fragmentTokens]);

  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Etape 1: établir session
  useEffect(() => {
    (async () => {
      try {
        // 1. Si session déjà là, on passe
        const { data: initial } = await supabase.auth.getSession();
        if (!initial.session) {
          let err: any = null;
          // Priorité: token & type (invite / signup / recovery) car liens email GoTrue renvoient cela.
          if (token && type && ['invite','signup','recovery'].includes(type)) {
            const email = expectedEmail || '';
            const r = await supabase.auth.verifyOtp({ type: type as any, token, email });
            err = r.error;
          } else {
            const at = access_token || fragmentTokens?.access_token;
            const rt = refresh_token || fragmentTokens?.refresh_token;
            if (at && rt) {
              const r = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
              err = r.error;
            } else if (code) {
              const r = await supabase.auth.exchangeCodeForSession(code);
              err = r.error;
            }
          }
          if (err) {
            setMsg(err.message || 'Impossible de valider le lien.');
            setLoading(false);
            return;
          }
        }

        // 2. Relecture de session
        const { data: after } = await supabase.auth.getSession();
        if (!after.session) {
          setMsg('Session introuvable. Lien invalide, expiré ou déjà utilisé.');
          setLoading(false);
          return;
        }
        const sessEmail = after.session.user.email?.toLowerCase();
        if (expectedEmail && sessEmail && expectedEmail !== sessEmail) {
          setMsg(`Vous êtes connecté en tant que ${sessEmail}. Déconnectez-vous pour accepter l'invitation destinée à ${expectedEmail}.`);
          setLoading(false);
          return;
        }

        const hasPassword = (after.session.user.user_metadata as any)?.has_password === true;
        if (!hasPassword) setNeedsPassword(true);
        else if (inviteId) {
          // Acceptation automatique si déjà un mot de passe.
          await acceptInvite(after.session.access_token!);
        } else {
          router.replace('/org');
        }
      } catch (e: any) {
        setMsg(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, code, access_token, refresh_token, fragmentTokens, token, type, inviteId, expectedEmail, router]);

  // Renvoi d'invitation (quand le lien ne contient plus de jetons valides)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMsg, setResendMsg] = useState('');
  const triggerResend = useCallback(async () => {
    if (!inviteId) return;
    setResendState('sending');
    setResendMsg('');
    try {
      const res = await fetch('/api/invites/resend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inviteId }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || j.note || 'Échec renvoi');
      setResendState('sent');
      setResendMsg(`Email renvoyé (${j.case})${j.generatedLink ? ' – lien régénéré.' : ''}`);
    } catch (e: any) {
      setResendState('error');
      setResendMsg(e?.message || 'Erreur renvoi');
    }
  }, [inviteId]);

  async function acceptInvite(bearer: string) {
    if (!inviteId) return;
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ inviteId })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Échec acceptation de l'invitation");
      return;
    }
    router.replace('/org');
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setMsg('Mot de passe trop court (min 8 caractères).');
      return;
    }
    if (password !== confirm) {
      setMsg('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      setBusy(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session perdue');
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ password })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Échec mise à jour mot de passe');
      if (inviteId) await acceptInvite(session.access_token);
      else router.replace('/org');
    } catch (e: any) {
      setMsg(e?.message || 'Erreur inattendue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: '64px auto', display: 'grid', gap: 16 }}>
      <h2>Invitation / Accès</h2>
      {loading && <p>Validation du lien…</p>}
      {!loading && msg && <>
        <p style={{ color: 'crimson', whiteSpace: 'pre-line' }}>{msg}</p>
        <p style={{ fontSize: 13 }}>
          Vérifiez que vous utilisez le dernier email reçu. Si besoin, renvoyez l'invitation.
        </p>
        {inviteId && (
          <div style={{ display: 'grid', gap: 8 }}>
            <button disabled={resendState === 'sending'} onClick={triggerResend}>
              {resendState === 'sending' ? 'Renvoi…' : resendState === 'sent' ? 'Email renvoyé ✔' : "Renvoyer l'invitation"}
            </button>
            {resendMsg && <p style={{ fontSize: 12, color: resendState === 'error' ? 'crimson' : 'green' }}>{resendMsg}</p>}
          </div>
        )}
      </>}
      {!loading && !msg && needsPassword && (
        <form onSubmit={submitPassword} style={{ display: 'grid', gap: 8 }}>
          <p>Définissez votre mot de passe pour continuer.</p>
          <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirmer" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer & Continuer'}</button>
        </form>
      )}
      {!loading && !msg && !needsPassword && <p>Redirection…</p>}
    </main>
  );
}
