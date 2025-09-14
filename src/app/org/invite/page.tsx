'use client';
import { useState } from 'react';

export default function InvitePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer'|'editor'>('viewer');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to invite');
      setMsg('Invite sent ✅');
      setEmail('');
      setRole('viewer');
    } catch (err:any) {
      setMsg(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{display:'grid', gap:12, maxWidth:480}}>
      <h2>Invite user</h2>
      <form onSubmit={onSubmit} style={{display:'grid', gap:8}}>
        <input type="email" placeholder="user@example.com" value={email}
               onChange={e=>setEmail(e.target.value)} required />
        <select value={role} onChange={e=>setRole(e.target.value as any)}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </form>
      {msg && <p style={{color:'#0a0'}}>{msg}</p>}
    </section>
  );
}
