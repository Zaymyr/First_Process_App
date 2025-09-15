'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoleForm({ departementId }: { departementId: number }) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/departements/${departementId}/roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to create role');
      setName('');
      router.refresh();
    } catch (e:any) {
      setError(e.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="row" style={{ gap: 8 }}>
      <input className="input" placeholder="New role" value={name} onChange={(e)=>setName(e.target.value)} required />
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add role'}</button>
      {error && <span style={{ color: 'crimson' }}>{error}</span>}
    </form>
  );
}
