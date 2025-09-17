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
      if (data.session) { setReady(true); return; }
      if (!emailHint || attemptedRef.current) {
        setMsg("Lien invalide ou expiré. Redemandez un email.");
        return;
      }
      attemptedRef.current = true;
      // Attempt to start a fresh recovery email silently
      try {
        const res = await fetch('/api/auth/begin-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: emailHint, inviteId }) });
        if (!res.ok) {
          const j = await res.json();
          setMsg(j?.error || 'Impossible de démarrer la récupération.');
          return;
        }
        setMsg("Nous avons renvoyé un lien à votre adresse. Ouvrez l'email le plus récent.");
      } catch (e: any) {
        setMsg(e?.message || 'Erreur lors de la tentative de récupération.');
      }
    })();
  }, [supabase, emailHint, inviteId]);

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

  return (
    <section style={{ maxWidth: 420, margin: '64px auto', display: 'grid', gap: 12 }}>
      <h2>Définir votre mot de passe</h2>
      {!ready && !msg && <p>Vérification de la session…</p>}
      {msg && !ready && <p style={{ color: 'crimson' }}>{msg}</p>}
      {ready && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
          {emailHint && <p style={{ fontSize: 14, color: '#555' }}>{emailHint}</p>}
          <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirmer" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : (inviteId ? 'Enregistrer et rejoindre' : 'Enregistrer')}</button>
        </form>
      )}
    </section>
  );
}
