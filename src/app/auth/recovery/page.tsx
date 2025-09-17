"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const pollRef = useRef<number | null>(null);

  // Process auth parameters (code, token/type, fragment) then poll for session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    async function processAuth(): Promise<boolean> {
      // PKCE code
      if (sp.get("code")) {
        try {
          await supabase.auth.exchangeCodeForSession(url.search.slice(1));
          ["code", "type", "scope", "auth_type"].forEach((k) => sp.delete(k));
          window.history.replaceState({}, "", url.pathname + (sp.toString() ? "?" + sp.toString() : ""));
        } catch (e: any) {
          setMsg(e?.message || "Échec de l'échange du code. Demandez un nouveau lien.");
          setPhase("error");
          return true; // stop further polling
        }
      }
      // OTP recovery / signup link
      if (sp.get("token") && sp.get("type")) {
        try {
          await supabase.auth.verifyOtp({ token_hash: sp.get("token")!, type: sp.get("type") as any });
          ["token", "type"].forEach((k) => sp.delete(k));
          window.history.replaceState({}, "", url.pathname + (sp.toString() ? "?" + sp.toString() : ""));
        } catch {
          setMsg("Lien invalide ou expiré. Renvoyez un nouveau lien.");
          setPhase("error");
          return true;
        }
      }
      // Fragment tokens already parsed by detectSessionInUrl; just clean hash
      if (location.hash.startsWith("#access_token")) {
        history.replaceState({}, "", url.pathname + (sp.toString() ? "?" + sp.toString() : ""));
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPhase("form");
        setMsg("");
        return true;
      }
      return false;
    }

    (async () => {
      const ready = await processAuth();
      if (ready) return;
      // not ready yet; show resend UI (error phase) but keep polling
      setPhase("error");
      setMsg("Ouvrez le lien reçu par email pour définir votre mot de passe, ou renvoyez-vous un nouveau lien.");
      const start = Date.now();
      pollRef.current = window.setInterval(async () => {
        if (Date.now() - start > 60_000) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        const ok = await processAuth();
        if (ok && pollRef.current) {
          clearInterval(pollRef.current);
        }
      }, 2_000);
    })();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [supabase]);

  async function resendReset() {
    if (!resetEmail) return;
    try {
      setBusy(true);
      const key = `recovery_resend_${resetEmail}`;
      const last = Number(localStorage.getItem(key) || "0");
      if (Date.now() - last < 60_000) {
        setMsg("Veuillez patienter avant de demander un nouveau lien.");
        return;
      }
      const base = window.location.origin;
      // Redirect directly back here (no callback bounce) to keep things simple.
      const redirectTo = `${base}/auth/recovery?em=${encodeURIComponent(resetEmail)}${inviteId ? `&inviteId=${inviteId}` : ""}`;
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
