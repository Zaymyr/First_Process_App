"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

// Completely fresh minimal page: assumes session already established by /auth/callback.
export default function NewPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const inviteId = sp.get('inviteId') || '';
  const emailHint = sp.get('em') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        // Vérification de l'email de la session vs email de l'invitation
        const sessionEmail = session.user?.email?.toLowerCase();
        const inviteEmail = emailHint.toLowerCase();
        if (sessionEmail && inviteEmail && sessionEmail !== inviteEmail) {
          setMsg(`Vous êtes connecté en tant que ${sessionEmail}. Veuillez vous déconnecter avant d'accepter l'invitation pour ${inviteEmail}.`);
          return;
        }
        setReady(true);
        return;
      }

      // Vérifie la présence d'un code ou token dans l'URL
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const access_token = url.searchParams.get('access_token');
      const refresh_token = url.searchParams.get('refresh_token');

      let error = null;
      if (code) {
        const res = await supabase.auth.exchangeCodeForSession(code);
        error = res.error;
      } else if (access_token && refresh_token) {
        const res = await supabase.auth.setSession({ access_token, refresh_token });
        error = res.error;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const session2 = sessionData.session;
      if (session2) {
        const sessionEmail2 = session2.user?.email?.toLowerCase();
        const inviteEmail2 = emailHint.toLowerCase();
        if (sessionEmail2 && inviteEmail2 && sessionEmail2 !== inviteEmail2) {
          setMsg(`Vous êtes connecté en tant que ${sessionEmail2}. Veuillez vous déconnecter avant d'accepter l'invitation pour ${inviteEmail2}.`);
          return;
        }
        setReady(true);
        return;
      }
      setMsg(error?.message || "Lien invalide ou expiré. Redemandez un email.");
    })();
  }, [supabase, emailHint]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password !== confirm) {
      setMsg('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      setBusy(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/auth/password', { method: 'POST', headers, body: JSON.stringify({ password }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Échec update mot de passe');
      if (inviteId) {
        const accept = await fetch('/api/invites/accept', { method: 'POST', headers, body: JSON.stringify({ inviteId }) });
        if (!accept.ok) {
          const aj = await accept.json();
          throw new Error(aj?.error || "Échec de l'acceptation de l'invitation");
        }
      }
      router.replace(`/org?toast=${encodeURIComponent(inviteId ? 'Invitation acceptée' : 'Mot de passe mis à jour')}&kind=success`);
    } catch (e: any) {
      setMsg(e?.message || 'Erreur inattendue');
    } finally {
      setBusy(false);
    }
  }

  async function resendLink() {
    setMsg('');
    try {
      const base = window.location.origin;
      const nextPath = `/auth/new-password?inviteId=${encodeURIComponent(inviteId)}&em=${encodeURIComponent(emailHint)}`;
      const redirectTo = `${base}/auth/cb?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(emailHint, { redirectTo });
      if (error) throw error;
      setMsg('Un nouveau lien a été envoyé. Vérifiez votre boîte email.');
    } catch (e: any) {
  setMsg(e?.message || "Erreur lors de l'envoi du lien");
    }
  }

  return (
    <section style={{ maxWidth: 420, margin: '64px auto', display: 'grid', gap: 12 }}>
      <h2>Définir votre mot de passe</h2>
      {!ready && (
        <>
          <p style={{ color: 'crimson' }}>{msg || 'Vérification du lien…'}</p>
          {inviteId && emailHint && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-outline" onClick={resendLink}>Renvoyer le lien</button>
            </div>
          )}
        </>
      )}
      {ready && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
          <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirmer" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>
      )}
    </section>
  );
}
