'use client';

import { useEffect, useState } from 'react';
import RoleDeleteButton from './RoleDeleteButton';

type Role = { id: number; name: string; departement_id: number };

type Props = {
  role: Role;
  onRenamed?: (roleId: number, name: string) => void;
  onDeleted?: (roleId: number) => void;
};

export default function RoleListItem({ role, onRenamed, onDeleted }: Props) {
  const { id } = role;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(role.name);
  }, [role.name]);

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
      const res = await fetch(`/api/org/roles/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to rename role');
      setName(trimmed);
      setEditing(false);
      onRenamed?.(id, trimmed);
    } catch (e: any) {
      setError(e?.message || 'Failed to rename role');
    } finally {
      setPending(false);
    }
  }

  function onCancel() {
    setEditing(false);
    setName(role.name);
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
              placeholder="Role name"
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
            <span>{role.name}</span>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setError(null);
                setEditing(true);
              }}
            >
              Rename
            </button>
          </div>
        )}
      </div>
      <RoleDeleteButton
        departementId={role.departement_id}
        roleId={id}
        onDeleted={() => onDeleted?.(id)}
      />
    </li>
  );
}
