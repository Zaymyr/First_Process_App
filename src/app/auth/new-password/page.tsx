"use client";
import { useEffect, useState, useMemo } from 'react';
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // No session => instruct user to reopen the link (callback should have created session)
        setMsg("Lien invalide ou expiré. Redemandez un email.");
      } else {
        setReady(true);
      }
    })();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password !== confirm) {
      setMsg('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      setBusy(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string,string> = { 'content-type':'application/json' };
      if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/auth/password', { method:'POST', headers, body: JSON.stringify({ password }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Échec update mot de passe');
      if (inviteId) {
        const accept = await fetch('/api/invites/accept', { method:'POST', headers, body: JSON.stringify({ inviteId }) });
        if (!accept.ok) {
          const aj = await accept.json();
            throw new Error(aj?.error || "Échec de l'acceptation de l'invitation");
        }
      }
      router.replace(`/org?toast=${encodeURIComponent(inviteId ? 'Invitation acceptée' : 'Mot de passe mis à jour')}&kind=success`);
    } catch (e:any) {
      setMsg(e?.message || 'Erreur inattendue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth:420, margin:'64px auto', display:'grid', gap:12 }}>
      <h2>Définir votre mot de passe</h2>
      {!ready && !msg && <p>Vérification de la session…</p>}
      {msg && !ready && <p style={{ color:'crimson' }}>{msg}</p>}
      {ready && (
        <form onSubmit={submit} style={{ display:'grid', gap:8 }}>
          {emailHint && <p style={{ fontSize:14, color:'#555' }}>{emailHint}</p>}
          <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirmer" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : (inviteId ? 'Enregistrer et rejoindre' : 'Enregistrer')}</button>
        </form>
      )}
    </section>
  );
}
