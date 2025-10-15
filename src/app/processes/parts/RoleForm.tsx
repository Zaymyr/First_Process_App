'use client';

import { useState } from 'react';

type Role = { id: number; name: string; departement_id: number };

type Props = {
  departementId: number;
  onCreated?: (role: Role) => void;
};

export default function RoleForm({ departementId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/departements/${departementId}/roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to create role');
      setName('');
      if (typeof j?.id === 'number') {
        onCreated?.({ id: j.id, name: trimmed, departement_id: departementId });
      }
    } catch (e:any) {
      setError(e.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="row" style={{ gap: 8 }}>
      <input
        className="input"
        placeholder="New role"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (error) setError(null);
        }}
        required
      />
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add role'}</button>
      {error && <span style={{ color: 'crimson' }}>{error}</span>}
    </form>
  );
}
