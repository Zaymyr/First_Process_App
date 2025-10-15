'use client';

import { useState } from 'react';

type Props = {
  departementId: number;
  roleId: number;
  onDeleted?: () => void;
};

export default function RoleDeleteButton({ departementId, roleId, onDeleted }: Props) {
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm('Delete this role?')) return;
    setPending(true);
    try {
      const res = await fetch(`/api/org/departements/${departementId}/roles`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to delete role');
      onDeleted?.();
    } catch (error: any) {
      alert(error?.message || 'Failed to delete role');
    } finally {
      setPending(false);
    }
  }

  return (
    <button className="btn btn-danger" onClick={onDelete} disabled={pending}>
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
