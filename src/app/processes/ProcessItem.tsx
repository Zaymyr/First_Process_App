'use client';

import { useMemo, useState } from 'react';

type Dept = { id: number; name: string | null; organization_id: string };

export default function ProcessItem({
  item,
  departements,
}: {
  item: { id: string; name: string; organization_id: string; departement_id: number | null; updated_at: string | null };
  departements: Dept[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [dept, setDept] = useState<string>(item.departement_id?.toString() ?? '');

  const updated =
    item.updated_at
      ? new Date(item.updated_at).toISOString().replace('T', ' ').slice(0, 19)
      : '—';

  const deptsForOrg = useMemo(
    () => departements.filter((d) => d.organization_id === item.organization_id),
    [departements, item.organization_id]
  );

  async function save() {
    const res = await fetch(`/api/processes/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        departement_id: dept === '' ? null : Number(dept), // server checks org match
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || 'Failed to update');
      return;
    }
    setEditing(false);
    window.location.href = '/processes?toast=' + encodeURIComponent('Process updated') + '&kind=success';
  }

  async function remove() {
    if (!confirm('Delete this process?')) return;
    const res = await fetch(`/api/processes/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || 'Failed to delete');
      return;
    }
    window.location.href = '/processes?toast=' + encodeURIComponent('Process deleted') + '&kind=success';
  }

  if (editing) {
    return (
      <li>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="">— no department —</option>
          {deptsForOrg.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name ?? `Dept ${d.id}`}
            </option>
          ))}
        </select>

        <button onClick={save} style={{ marginLeft: 8 }}>Save</button>
        <button onClick={() => setEditing(false)} style={{ marginLeft: 8 }}>Cancel</button>
      </li>
    );
  }

  return (
    <li>
      <strong>{item.name}</strong> — org: {item.organization_id} —{' '}
      <time dateTime={item.updated_at ?? ''}>{updated}</time>
      <button onClick={() => setEditing(true)} style={{ marginLeft: 8 }}>Edit</button>
      <button onClick={remove} style={{ marginLeft: 8, color: 'crimson' }}>Delete</button>
    </li>
  );
}
