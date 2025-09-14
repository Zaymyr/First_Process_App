'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [pendingPwd, setPendingPwd] = useState(false);

  useEffect(() => {
  (async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      router.replace('/login');
      return;
    }
    setEmail(user.email ?? null);  // ✅ normalize undefined → null
    setFullName((user.user_metadata as any)?.full_name ?? '');
    setLoading(false);
  })();
}, [supabase, router]);


  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (error) setMessage(error.message);
    else setMessage('Profile updated ✅');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setPendingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage('Password updated ✅');
      setNewPassword('');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setPendingPwd(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <section style={{ maxWidth: 480, display: 'grid', gap: 24 }}>
      <h2>My Profile</h2>

      <div>
        <p><strong>Email:</strong> {email}</p>
      </div>

      <form onSubmit={updateProfile} style={{ display: 'grid', gap: 8 }}>
        <label>
          Full name:
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <button type="submit">Save profile</button>
      </form>

      <form onSubmit={changePassword} style={{ display: 'grid', gap: 8 }}>
        <label>
          New password:
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <button type="submit" disabled={pendingPwd || !newPassword}>
          {pendingPwd ? 'Updating…' : 'Change password'}
        </button>
      </form>

      {message && <p style={{ color: 'teal' }}>{message}</p>}
    </section>
  );
}
