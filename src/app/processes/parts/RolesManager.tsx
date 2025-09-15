'use client';

import { useEffect, useMemo, useState } from 'react';

type Dept = { id: number; name: string | null };
type Role = { id: number; name: string };

export default function RolesManager({ deps }: { deps: Dept[] }) {
  const [selected, setSelected] = useState<number | ''>(deps[0]?.id ?? '');
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  const canManage = useMemo(() => selected !== '', [selected]);

  useEffect(() => {
    if (selected === '') { setRoles(null); return; }
    (async () => {
      const res = await fetch(`/api/org/departements/${selected}/roles`);
      const j = await res.json();
      if (res.ok) setRoles(j.roles as Role[]);
    })();
  }, [selected]);

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (selected === '') return;
    setPending(true);
    try {
      const res = await fetch(`/api/org/departements/${selected}/roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed');
      setName('');
      const res2 = await fetch(`/api/org/departements/${selected}/roles`);
      const j2 = await res2.json();
      if (res2.ok) setRoles(j2.roles as Role[]);
    } finally {
      setPending(false);
    }
  }

  async function delRole(id: number) {
    if (selected === '') return;
    if (!confirm('Delete this role?')) return;
    setPending(true);
    try {
      const res = await fetch(`/api/org/departements/${selected}/roles`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roleId: id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed');
      const res2 = await fetch(`/api/org/departements/${selected}/roles`);
      const j2 = await res2.json();
      if (res2.ok) setRoles(j2.roles as Role[]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card stack">
      <label className="stack" style={{ gap: 4 }}>
        <span>Department</span>
        <select className="select" value={selected} onChange={(e)=>setSelected(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">— Select a department —</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>{d.name ?? `Dept ${d.id}`}</option>
          ))}
        </select>
      </label>

      {canManage && (
        <>
          <ul className="stack" style={{ gap: 6 }}>
            {roles?.map((r) => (
              <li key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                <span>{r.name}</span>
                <button className="btn btn-danger" onClick={() => delRole(r.id)} disabled={pending}>Delete</button>
              </li>
            ))}
            {!roles && <li className="muted">Loading…</li>}
            {roles && roles.length === 0 && <li className="muted">No roles yet.</li>}
          </ul>
          <form onSubmit={addRole} className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="New role" value={name} onChange={(e)=>setName(e.target.value)} required />
            <button className="btn" type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add role'}</button>
          </form>
        </>
      )}
    </div>
  );
}
