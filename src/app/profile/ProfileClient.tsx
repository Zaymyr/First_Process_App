'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';

type Props = { email: string | null; initialFullName: string; role: string | null };

export default function ProfileClient({ email, initialFullName, role }: Props) {
  const supabase = createClient();

  const [fullName, setFullName] = useState<string>(initialFullName);
  const [message, setMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [pendingPwd, setPendingPwd] = useState(false);

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
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

  return (
    <section style={{ maxWidth: 480, display: 'grid', gap: 24 }}>
      <h2>My Profile</h2>

      <div>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Role:</strong> {role ?? '—'}</p>
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
