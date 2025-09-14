'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [pwd, setPwd] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // sécurité : si pas de session active, renvoyer vers /login
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace('/login');
    })();
  }, [router, supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      // 🔑 on met à jour le mot de passe
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;

      // ✅ on récupère la session pour vérifier que l'utilisateur est connecté
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setMsg('Password updated ✅');
        // rediriger vers la Home
        router.replace('/?toast=' + encodeURIComponent('Password updated') + '&kind=success');
        router.refresh();

      } else {
        setMsg('Password updated, please log in again.');
        router.replace('/login');
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to update password');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{ maxWidth: 420, display: 'grid', gap: 12 }}>
      <h2>Set a new password</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input
          type="password"
          placeholder="New password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
        />
        <button type="submit" disabled={pending || pwd.length < 6}>
          {pending ? 'Updating…' : 'Update password'}
        </button>
      </form>
      {msg && <p style={{ color: 'teal' }}>{msg}</p>}
    </section>
  );
}
