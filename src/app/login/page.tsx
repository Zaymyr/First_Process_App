'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const search = useSearchParams();
  const nextUrl = search.get('next') || '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // If already signed in, go to next/home
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(nextUrl);
    })();
  }, [router, supabase, nextUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split('@')[0] } },
        });
        if (error) throw error;
      }
      router.replace(nextUrl);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || 'Authentication error');
    } finally {
      setPending(false);
    }
  }

  async function sendReset() {
    setErr(null);
    if (!email) { setErr('Enter your email first'); return; }
    try {
      // Send recovery link to the page that can handle PKCE, fragments, and OTP flows
      const base = window.location.origin;
      const nextUrl = `${base}/auth/recovery?em=${encodeURIComponent(email)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: nextUrl,
      });
      if (error) throw error;
      alert('Check your email for a reset link');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send reset email');
    }
  }

  return (
    <section style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100dvh - 56px)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="brand" style={{ fontSize: 22 }}>First Process</div>
          <div className="muted" style={{ marginTop: 4 }}>
            {mode === 'signin' ? 'Connectez-vous à votre compte' : "Créez votre compte"}
          </div>
        </div>

        <form onSubmit={submit} className="stack">
          <input className="input" type="email" placeholder="you@example.com" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Mot de passe"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn btn-lg" type="submit" disabled={pending}>
            {pending ? 'Veuillez patienter…' : (mode === 'signin' ? 'Se connecter' : "Créer un compte")}
          </button>
        </form>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? "Pas de compte ? Créez-en un" : "Déjà un compte ? Connectez-vous"}
          </button>
          <button className="btn btn-outline" onClick={sendReset}>Mot de passe oublié ?</button>
        </div>

        {err && <p style={{ color: 'crimson', marginTop: 8 }}>{err}</p>}
      </div>
    </section>
  );
}
