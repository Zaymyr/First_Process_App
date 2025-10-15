'use client';

import { useMemo, useState } from 'react';

type Dept = { id: number; name: string | null; organization_id: string };

export default function ProcessItem({
  item,
  departements,
  onSelect,
  selected = false,
}: {
  item: {
    id: string;
    name: string;
    organization_id: string;
    departement_id: number | null;
    updated_at: string | null;
  };
  departements: Dept[];
  onSelect?: (id: string) => void;
  selected?: boolean;
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

  const deptName = useMemo(() => {
    if (!item.departement_id) return null;
    const found = deptsForOrg.find((d) => d.id === item.departement_id);
    return found?.name ?? `Dept ${item.departement_id}`;
  }, [deptsForOrg, item.departement_id]);

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
    window.location.href =
      '/processes?toast=' + encodeURIComponent('Process deleted') + '&kind=success';
  }

  const classes = ['card', 'processes-list-item'];
  if (selected) classes.push('selected');
  if (editing) classes.push('editing');
  const className = classes.join(' ');

  function handleSelect() {
    if (editing) return;
    onSelect?.(item.id);
  }

  if (editing) {
    return (
      <li className={className}>
        <div className="stack" style={{ gap: 10 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Process name"
          />
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Departement
            </span>
            <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">— no department —</option>
              {deptsForOrg.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? `Dept ${d.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="processes-list-item-actions">
          <button className="btn" onClick={save}>
            Save
          </button>
          <button className="btn btn-outline" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={className}>
      <div className="processes-list-item-header">
        <button
          type="button"
          className="processes-list-item-main"
          onClick={(event) => {
            event.stopPropagation();
            handleSelect();
          }}
        >
          <strong>{item.name}</strong>
          <div className="processes-list-item-meta">
            <span>{deptName ?? 'No department'}</span>
            <span>
              Last update:{' '}
              <time dateTime={item.updated_at ?? ''}>{updated}</time>
            </span>
          </div>
        </button>
        <div className="processes-list-item-actions">
          <button
            className="btn btn-outline"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button
            className="btn btn-danger"
            onClick={(event) => {
              event.stopPropagation();
              remove();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
