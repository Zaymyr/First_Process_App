// src/app/set-password/page.tsx (réimplémentation)
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function SetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get("inviteId") ?? "";
  const emailHint = params.get("em") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"checking"|"form"|"updating"|"done"|"error">("checking");

  // 1) Normaliser les scénarios d'arrivée: fragment tokens, code PKCE, OTP token/type
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    // fragment tokens (implicit flow)
    if (location.hash && location.hash.startsWith('#access_token')) {
      const frag = new URLSearchParams(location.hash.slice(1));
      const q = new URLSearchParams();
      q.set('next', `/set-password?inviteId=${inviteId}`);
      for (const k of ['access_token','refresh_token','expires_in','expires_at','token_type','type','provider_token']) {
        const v = frag.get(k); if (v) q.set(k, v);
      }
      // Nettoyage URL et synchro cookies serveur
      history.replaceState({}, '', `/set-password?inviteId=${inviteId}`);
      location.assign(`/auth/callback?${q.toString()}`);
      return;
    }

    // code PKCE ou tokens en query
    const hasCode = url.searchParams.has('code');
    const hasTokensInQuery = url.searchParams.has('access_token') && url.searchParams.has('refresh_token');
    if (hasCode || hasTokensInQuery) {
      const q = new URLSearchParams(url.search);
      q.set('next', `/set-password?inviteId=${inviteId}`);
      history.replaceState({}, '', `/set-password?inviteId=${inviteId}`);
      location.assign(`/auth/callback?${q.toString()}`);
      return;
    }

    // OTP flow (?token & type=recovery|signup|magiclink)
    const hasOtpToken = url.searchParams.has('token') && url.searchParams.has('type');
    if (hasOtpToken) {
      const token = url.searchParams.get('token')!;
      const type = url.searchParams.get('type')! as 'recovery'|'signup'|'magiclink'|'email_change';
      history.replaceState({}, '', `/set-password?inviteId=${inviteId}`);
      (async () => {
        try {
          await supabase.auth.verifyOtp({ token_hash: token, type });
          // Session client ok -> poser cookies serveur via callback
          const cur = await supabase.auth.getSession();
          const at = cur.data.session?.access_token;
          const rt = (cur.data.session as any)?.refresh_token;
          if (at && rt) {
            const next = `/set-password?inviteId=${encodeURIComponent(inviteId)}`;
            const q = new URLSearchParams({ access_token: at, refresh_token: rt, next });
            location.replace(`/auth/callback?${q.toString()}`);
            return;
          }
        } catch (e) {
          setMsg('Lien invalide ou expiré. Demandez un nouveau lien depuis l\'invitation.');
          setPhase('error');
          return;
        }
      })();
      return;
    }

    // Sinon, on affiche le formulaire si la session existe, sinon on essaie de renvoyer un lien si on a l'email
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) { setPhase('form'); return; }
      if (emailHint) {
        try {
          const base = window.location.origin;
          const redirectTo = `${base}/set-password?inviteId=${encodeURIComponent(inviteId)}&em=${encodeURIComponent(emailHint)}`;
          const { error } = await supabase.auth.resetPasswordForEmail(emailHint, { redirectTo });
          if (!error) {
            setMsg("Un nouveau lien vient d'être envoyé à " + emailHint + ". Ouvrez l'email le plus récent.");
          } else {
            setMsg(error.message);
          }
        } catch (e: any) {
          setMsg(e?.message || 'Impossible d\'envoyer un nouveau lien.');
        }
      } else {
        setMsg('Ouvrez le lien reçu par email pour définir votre mot de passe.');
      }
      setPhase('error');
    })();
  }, [supabase, inviteId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password !== confirm) {
      setMsg('Les mots de passe ne correspondent pas.');
      setPhase('error');
      return;
    }
    try {
      setBusy(true);
      setPhase('updating');
      const cur = await supabase.auth.getSession();
      const at = cur.data.session?.access_token;
      const headers: Record<string,string> = { 'content-type': 'application/json' };
      if (at) headers['authorization'] = `Bearer ${at}`;
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || 'Échec de la mise à jour du mot de passe.');
        setPhase('error');
        setBusy(false);
        return;
      }
      // Après update password, aller accepter l'invitation
      const accept = await fetch('/api/invites/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify({ inviteId }),
      });
      if (!accept.ok) {
        const aj = await accept.json();
        setMsg(aj?.error || 'Échec de l\'acceptation de l\'invitation.');
        setPhase('error');
        setBusy(false);
        return;
      }
      setPhase('done');
      // Rediriger vers l'accueil org
      router.replace('/org?toast=' + encodeURIComponent('Bienvenue ! Votre mot de passe est défini et l’invitation est acceptée.') + '&kind=success');
    } catch (e: any) {
      setMsg(e?.message || 'Erreur inattendue.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: 12, maxWidth: 420, margin: '64px auto' }}>
      <h2>Définir votre mot de passe</h2>
      {phase === 'checking' && <p>Préparation…</p>}
      {phase === 'form' && (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
          <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? 'Mise à jour…' : 'Enregistrer et rejoindre'}</button>
        </form>
      )}
      {phase === 'updating' && <p>Mise à jour du mot de passe…</p>}
      {phase === 'done' && <p>Terminé — redirection…</p>}
      {phase === 'error' && <p style={{ color: 'crimson' }}>{msg}</p>}
    </section>
  );
}
