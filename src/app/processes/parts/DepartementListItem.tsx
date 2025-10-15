'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DepartementDeleteButton from './DepartementDeleteButton';

type Departement = { id: number; name: string | null };

type Props = {
  departement: Departement;
};

export default function DepartementListItem({ departement }: Props) {
  const { id } = departement;
  const displayName = departement.name ?? `Dept ${id}`;
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(departement.name ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(departement.name ?? '');
  }, [departement.name]);

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
      const res = await fetch(`/api/org/departements/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to rename department');
      setName(trimmed);
      setEditing(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to rename department');
    } finally {
      setPending(false);
    }
  }

  function onCancel() {
    setEditing(false);
    setName(departement.name ?? '');
    setError(null);
  }

  return (
    <li className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div className="stack" style={{ gap: 6, flex: 1 }}>
        {editing ? (
          <form onSubmit={onSubmit} className="stack" style={{ gap: 6 }}>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Department name"
              required
            />
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-outline" type="button" onClick={onCancel} disabled={pending}>
                Cancel
              </button>
            </div>
            {error && <span style={{ color: 'crimson', fontSize: 14 }}>{error}</span>}
          </form>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{displayName}</span>
            <button className="btn btn-outline" type="button" onClick={() => setEditing(true)}>
              Rename
            </button>
          </div>
        )}
      </div>
      <DepartementDeleteButton id={id} />
    </li>
  );
}
