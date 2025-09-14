'use client';
import { useState } from 'react';

export default function OrgNameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial ?? '');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/org/name', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to update');
      setMsg('Saved ✅');
      // refresh to pull new name into server components/header
      window.location.href = '/org?toast=' + encodeURIComponent('Organization updated') + '&kind=success';
    } catch (err: any) {
      setMsg(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display:'flex', gap:8 }}>
      <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Organization name" />
      <button type="submit" disabled={pending || !name.trim()}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      {msg && <span style={{marginLeft:8, color:'#0a0'}}>{msg}</span>}
    </form>
  );
}
