"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

type Phase = "checking" | "form" | "updating" | "done" | "error";

export default function RecoveryPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get("inviteId") ?? "";
  const emailHint = params.get("em") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [resetEmail, setResetEmail] = useState(emailHint);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    // Case 1: implicit flow fragments (#access_token=...)
    if (location.hash && location.hash.startsWith("#access_token")) {
      const frag = new URLSearchParams(location.hash.slice(1));
      const nextPath = `/auth/recovery?inviteId=${inviteId}${emailHint ? `&em=${encodeURIComponent(emailHint)}` : ""}`;
      const q = new URLSearchParams();
      q.set("next", nextPath);
      for (const k of [
        "access_token",
        "refresh_token",
        "expires_in",
        "expires_at",
        "token_type",
        "type",
        "provider_token",
      ]) {
        const v = frag.get(k);
        if (v) q.set(k, v);
      }
      history.replaceState({}, "", nextPath);
      location.assign(`/auth/callback?${q.toString()}`);
      return;
    }

    // Case 2: PKCE code or tokens in query
    const hasCode = url.searchParams.has("code");
    const hasTokens = url.searchParams.has("access_token") && url.searchParams.has("refresh_token");
    if (hasCode || hasTokens) {
      const q = new URLSearchParams(url.search);
      const nextPath = `/auth/recovery?inviteId=${inviteId}${emailHint ? `&em=${encodeURIComponent(emailHint)}` : ""}`;
      q.set("next", nextPath);
      history.replaceState({}, "", nextPath);
      location.assign(`/auth/callback?${q.toString()}`);
      return;
    }

    // Case 3: OTP token
    const hasOtp = url.searchParams.has("token") && url.searchParams.has("type");
    if (hasOtp) {
      const token = url.searchParams.get("token")!;
      const type = url.searchParams.get("type")! as "recovery" | "signup" | "magiclink" | "email_change";
      const nextPath = `/auth/recovery?inviteId=${inviteId}${emailHint ? `&em=${encodeURIComponent(emailHint)}` : ""}`;
      history.replaceState({}, "", nextPath);
      (async () => {
        try {
          await supabase.auth.verifyOtp({ token_hash: token, type });
          const cur = await supabase.auth.getSession();
          const at = cur.data.session?.access_token;
          const rt = (cur.data.session as any)?.refresh_token;
          if (at && rt) {
            const q = new URLSearchParams({ access_token: at, refresh_token: rt, next: nextPath });
            location.replace(`/auth/callback?${q.toString()}`);
            return;
          }
          setPhase("form");
        } catch (e) {
          setMsg("Lien invalide ou expiré. Renvoyez un nouveau lien.");
          setPhase("error");
        }
      })();
      return;
    }

    // Default: show form if session exists; else error with resend option
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setPhase("form");
      else {
        setMsg("Ouvrez le lien reçu par email pour définir votre mot de passe, ou renvoyez-vous un nouveau lien.");
        setPhase("error");
      }
    })();
  }, [supabase, inviteId, emailHint]);

  async function resendReset() {
    try {
      if (!resetEmail) return;
      const key = `reco_throttle_${inviteId || "noinv"}`;
      const last = Number(localStorage.getItem(key) || "0");
      if (Date.now() - last < 60_000) {
        setMsg("Veuillez patienter avant de redemander un lien.");
        return;
      }
      setBusy(true);
      setResetSent(false);
      const base = window.location.origin;
      const next = `/auth/recovery?inviteId=${inviteId}${resetEmail ? `&em=${encodeURIComponent(resetEmail)}` : ""}`;
      const redirectTo = `${base}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo });
      if (error) {
        setMsg(error.message);
        return;
      }
      localStorage.setItem(key, String(Date.now()));
      setResetSent(true);
      setMsg(`Un nouveau lien a été envoyé à ${resetEmail}. Ouvrez l'email le plus récent.`);
    } catch (e: any) {
      setMsg(e?.message || "Échec de l'envoi du lien.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password !== confirm) {
      setMsg("Les mots de passe ne correspondent pas.");
      setPhase("error");
      return;
    }
    try {
      setBusy(true);
      setPhase("updating");
      const cur = await supabase.auth.getSession();
      const at = cur.data.session?.access_token;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (at) headers["authorization"] = `Bearer ${at}`;
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers,
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j?.error || "Échec de la mise à jour du mot de passe.");
        setPhase("error");
        setBusy(false);
        return;
      }
      if (inviteId) {
        const accept = await fetch("/api/invites/accept", {
          method: "POST",
          headers,
          body: JSON.stringify({ inviteId }),
        });
        if (!accept.ok) {
          const aj = await accept.json();
          setMsg(aj?.error || "Échec de l'acceptation de l'invitation.");
          setPhase("error");
          setBusy(false);
          return;
        }
      }
      setPhase("done");
      router.replace(
        `/org?toast=${encodeURIComponent(
          inviteId
            ? "Bienvenue ! Votre mot de passe est défini et l’invitation est acceptée."
            : "Mot de passe mis à jour."
        )}&kind=success`
      );
    } catch (e: any) {
      setMsg(e?.message || "Erreur inattendue.");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 12, maxWidth: 420, margin: "64px auto" }}>
      <h2>Définir votre mot de passe</h2>
      {phase === "checking" && <p>Préparation…</p>}
      {phase === "form" && (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
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
          <button type="submit" disabled={busy}>
            {busy ? "Mise à jour…" : inviteId ? "Enregistrer et rejoindre" : "Enregistrer"}
          </button>
        </form>
      )}
      {phase === "updating" && <p>Mise à jour du mot de passe…</p>}
      {phase === "done" && <p>Terminé — redirection…</p>}
      {phase === "error" && (
        <>
          <p style={{ color: "crimson" }}>{msg}</p>
          <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
            <label>
              Votre email
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="votre@email.com"
              />
            </label>
            <button type="button" onClick={resendReset} disabled={busy || !resetEmail}>
              {busy ? "Envoi…" : "Renvoyer un lien"}
            </button>
            {resetSent && <p style={{ color: "green" }}>Lien envoyé. Consultez l'email le plus récent.</p>}
          </div>
        </>
      )}
    </section>
  );
}
