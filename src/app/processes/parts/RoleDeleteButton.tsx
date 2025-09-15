'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoleDeleteButton({ departementId, roleId }: { departementId: number; roleId: number }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

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
      router.refresh();
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
