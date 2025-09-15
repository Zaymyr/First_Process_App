'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DepartementDeleteButton({ id }: { id: number }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onDelete() {
    if (!confirm('Delete this department?')) return;
    setPending(true);
    try {
      const res = await fetch('/api/org/departements', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to delete');
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
