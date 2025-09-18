"use client";
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

/*
  Page d'atterrissage unifiée (signup, recovery, magic link). Invitations décommissionnées.
  Paramètres potentiels: token&type, code (legacy), access_token/refresh_token (query ou fragment), em=email attendu.
*/
export default function AcceptPage() {
  const supabase = useMemo(() => createClient(), []);
  const sp = useSearchParams();
  const router = useRouter();

  const expectedEmail = (sp.get('em') || '').toLowerCase();
  const token = sp.get('token');
  const type = sp.get('type');
  const code = sp.get('code');
  const access_token = sp.get('access_token');
  const refresh_token = sp.get('refresh_token');

  const [fragmentTokens, setFragmentTokens] = useState<{ access_token?: string; refresh_token?: string } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (fragmentTokens) return;
    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const at = params.get('access_token') || undefined;
      const rt = params.get('refresh_token') || undefined;
      if (at) {
        setFragmentTokens({ access_token: at, refresh_token: rt });
        const clean = new URL(window.location.href); clean.hash='';
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

  useEffect(() => {
    (async () => {
      try {
        const { data: initial } = await supabase.auth.getSession();
        if (!initial.session) {
          let err: any = null;
            if (token && type && ['signup','recovery','invite'].includes(type)) {
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
        const { data: after } = await supabase.auth.getSession();
        if (!after.session) {
          setMsg('Session introuvable. Lien invalide, expiré ou déjà utilisé.');
          setLoading(false);
          return;
        }
        const sessEmail = after.session.user.email?.toLowerCase();
        if (expectedEmail && sessEmail && expectedEmail !== sessEmail) {
          setMsg(`Vous êtes connecté en tant que ${sessEmail}. Déconnectez-vous pour utiliser l'email ${expectedEmail}.`);
          setLoading(false);
          return;
        }
        const hasPassword = (after.session.user.user_metadata as any)?.has_password === true;
        if (!hasPassword) setNeedsPassword(true); else router.replace('/org');
      } catch (e: any) {
        setMsg(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, token, type, code, access_token, refresh_token, fragmentTokens, expectedEmail, router]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setMsg('Mot de passe trop court (min 8).'); return; }
    if (password !== confirm) { setMsg('Les mots de passe ne correspondent pas.'); return; }
    try {
      setBusy(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session perdue');
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ password })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Échec maj mot de passe');
      router.replace('/org');
    } catch (e: any) {
      setMsg(e?.message || 'Erreur inattendue');
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 440, margin: '64px auto', display: 'grid', gap: 16 }}>
      <h2>Accès</h2>
      {loading && <p>Validation du lien…</p>}
      {!loading && msg && <p style={{ color: 'crimson', whiteSpace: 'pre-line' }}>{msg}</p>}
      {!loading && !msg && needsPassword && (
        <form onSubmit={submitPassword} style={{ display: 'grid', gap: 8 }}>
          <p>Définissez votre mot de passe.</p>
          <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirmer" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer & Continuer'}</button>
        </form>
      )}
      {!loading && !msg && !needsPassword && <p>Redirection…</p>}
    </main>
  );
}
