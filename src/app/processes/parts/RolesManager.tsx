'use client';

import { useEffect, useMemo, useState } from 'react';
import RoleForm from './RoleForm';
import RoleListItem from './RoleListItem';

type Dept = { id: number; name: string | null };
type Role = { id: number; name: string; departement_id: number };

function sortRoles(list: Role[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export default function RolesManager({ deps }: { deps: Dept[] }) {
  const [selected, setSelected] = useState<number | ''>(deps[0]?.id ?? '');
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasDepartments = deps.length > 0;
  const selectedId = useMemo(() => (typeof selected === 'number' ? selected : null), [selected]);

  useEffect(() => {
    if (!hasDepartments) {
      setSelected('');
      setRoles([]);
      return;
    }
    setSelected((current) => {
      if (current === '' || !deps.some((dep) => dep.id === current)) {
        return deps[0].id;
      }
      return current;
    });
  }, [deps, hasDepartments]);

  useEffect(() => {
    if (!selectedId) {
      setRoles([]);
      setLoading(false);
      setErrorMsg(null);
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      try {
        const res = await fetch(`/api/org/departements/${selectedId}/roles`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load roles');
        if (!ignore) setRoles(sortRoles((payload.roles ?? []) as Role[]));
      } catch (error: any) {
        if (!ignore) {
          setRoles([]);
          setErrorMsg(error?.message || 'Failed to load roles');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [selectedId]);

  function handleRenamed(roleId: number, name: string) {
    setRoles((prev) => {
      if (!prev) return prev;
      return sortRoles(prev.map((role) => (role.id === roleId ? { ...role, name } : role)));
    });
  }

  function handleDeleted(roleId: number) {
    setRoles((prev) => {
      if (!prev) return prev;
      return prev.filter((role) => role.id !== roleId);
    });
  }

  function handleCreated(role: Role) {
    setRoles((prev) => {
      if (!prev) return [role];
      return sortRoles([...prev, role]);
    });
  }

  return (
    <div className="card stack">
      <label className="stack" style={{ gap: 4 }}>
        <span>Department</span>
        <select
          className="select"
          value={selected}
          onChange={(event) => {
            const value = event.target.value;
            setSelected(value === '' ? '' : Number(value));
          }}
          disabled={!hasDepartments}
        >
          <option value="">— Select a department —</option>
          {deps.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name ?? `Dept ${dep.id}`}
            </option>
          ))}
        </select>
      </label>

      {!hasDepartments && <p className="muted">Create a department before adding roles.</p>}

      {hasDepartments && !selectedId && (
        <p className="muted">Select a department to manage its roles.</p>
      )}

      {hasDepartments && selectedId && (
        <div className="stack" style={{ gap: 12 }}>
          {errorMsg && (
            <p className="error" style={{ color: 'var(--danger-color, #b81c1c)' }}>
              {errorMsg}
            </p>
          )}

          <ul className="stack" style={{ gap: 6 }}>
            {loading && <li className="muted">Loading…</li>}
            {!loading && roles?.map((role) => (
              <RoleListItem
                key={role.id}
                role={role}
                onRenamed={handleRenamed}
                onDeleted={handleDeleted}
              />
            ))}
            {!loading && roles && roles.length === 0 && <li className="muted">No roles yet.</li>}
          </ul>

          <RoleForm departementId={selectedId} onCreated={handleCreated} />
        </div>
      )}
    </div>
  );
}
