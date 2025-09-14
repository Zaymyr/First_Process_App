'use client';

import { useMemo, useState } from 'react';

type Dept = { id: number; name: string | null; organization_id: string };

export default function ProcessForm({
  orgId,
  departements,
}: {
  orgId: string;
  departements: Dept[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptsForOrg = useMemo(
    () => departements.filter((d) => d.organization_id === orgId),
    [departements, orgId]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const name = String(form.get('name') || '');
    const departement_idRaw = form.get('departement_id') as string | null;

    try {
      const body = {
        name,
        // ⬇️ no organization_id field from the client; server derives it
        departement_id: departement_idRaw ? Number(departement_idRaw) : null,
      };

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to create process');
      }

      formEl.reset();
      window.location.href = '/processes?toast=' + encodeURIComponent('Process created') + '&kind=success';
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <input name="name" placeholder="Process name" required />

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Departement</span>
        <select name="departement_id" defaultValue="">
          <option value="">— (optional)</option>
          {deptsForOrg.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name ?? `Dept ${d.id}`}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create'}
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  );
}
