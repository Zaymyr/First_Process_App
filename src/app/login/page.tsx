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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`
      });
      if (error) throw error;
      alert('Check your email for a reset link');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send reset email');
    }
  }

  return (
    <section style={{ maxWidth: 420, margin:'40px auto', display: 'grid', gap: 12 }}>
      <h2 style={{textAlign:'center'}}>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>

      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input type="email" placeholder="you@example.com" autoComplete="email"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password"
               autoComplete={mode==='signin'?'current-password':'new-password'}
               value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={pending}>
          {pending ? 'Please wait…' : (mode === 'signin' ? 'Sign in' : 'Sign up')}
        </button>
      </form>

      <div style={{display:'flex', justifyContent:'space-between'}}>
        <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
        <button onClick={sendReset}>Forgot password?</button>
      </div>

      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </section>
  );
}
