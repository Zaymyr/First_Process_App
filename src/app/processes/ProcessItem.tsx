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
      <li className="card" style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">— no department —</option>
          {deptsForOrg.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name ?? `Dept ${d.id}`}
            </option>
          ))}
        </select>
        <button className="btn" onClick={save}>Save</button>
        <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
      </li>
    );
  }

  return (
    <li className="card" style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'space-between' }}>
      <div>
        <strong>{item.name}</strong>
        <div className="muted" style={{ fontSize: 12 }}>
          Last update: <time dateTime={item.updated_at ?? ''}>{updated}</time>
        </div>
      </div>
      <div className="row">
        <button className="btn btn-outline" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-danger" onClick={remove}>Delete</button>
      </div>
    </li>
  );
}
