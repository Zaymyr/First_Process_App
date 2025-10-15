'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const MERMAID_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';

export type EditableStep = {
  id: string;
  title: string;
  roleId: number | null;
};

export type EditionRole = {
  id: number;
  name: string;
  departement_id: number | null;
};

export type EditionDepartement = {
  id: number;
  name: string | null;
};

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    definition: string
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }> | { svg: string };
};

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

let mermaidLoader: Promise<MermaidApi> | null = null;

function ensureMermaid(): Promise<MermaidApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid is not available server-side'));
  }
  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }
  if (mermaidLoader) {
    return mermaidLoader;
  }

  mermaidLoader = new Promise<MermaidApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MERMAID_SRC}"]`);
    if (existing) {
      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false });
        resolve(window.mermaid);
        return;
      }

      existing.addEventListener('load', () => {
        if (window.mermaid) {
          window.mermaid.initialize({ startOnLoad: false });
          resolve(window.mermaid);
        } else {
          reject(new Error('Mermaid failed to load'));
        }
      });
      existing.addEventListener('error', () => reject(new Error('Unable to load Mermaid')));
      return;
    }

    const script = document.createElement('script');
    script.src = MERMAID_SRC;
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false });
        resolve(window.mermaid);
      } else {
        reject(new Error('Mermaid failed to load'));
      }
    };
    script.onerror = () => {
      reject(new Error('Unable to load Mermaid'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    mermaidLoader = null;
    throw err;
  });

  return mermaidLoader;
}

function cloneSteps(steps: EditableStep[]): EditableStep[] {
  return steps.map((step) => ({ ...step }));
}

function escapeMermaidLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
    .trim();
}

function makeStepId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `step-${Math.random().toString(36).slice(2, 10)}`;
}

type Props = {
  processId: string;
  processName: string;
  initialSteps: EditableStep[];
  roles: EditionRole[];
  departements: EditionDepartement[];
};

export default function ProcessEditionClient({
  processId,
  processName,
  initialSteps,
  roles,
  departements,
}: Props) {
  const router = useRouter();
  const [steps, setSteps] = useState<EditableStep[]>(() => cloneSteps(initialSteps));
  const [baseline, setBaseline] = useState<EditableStep[]>(() => cloneSteps(initialSteps));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [diagramSvg, setDiagramSvg] = useState<string | null>(null);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [roleList, setRoleList] = useState<EditionRole[]>(() => roles.map((role) => ({ ...role })));
  const [roleBaseline, setRoleBaseline] = useState<EditionRole[]>(() => roles.map((role) => ({ ...role })));
  const [rolePendingId, setRolePendingId] = useState<number | null>(null);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [departementList, setDepartementList] = useState<EditionDepartement[]>(() =>
    departements.map((dept) => ({ ...dept }))
  );
  const [departementBaseline, setDepartementBaseline] = useState<EditionDepartement[]>(() =>
    departements.map((dept) => ({ ...dept }))
  );
  const [departementPendingId, setDepartementPendingId] = useState<number | null>(null);
  const [departementMessage, setDepartementMessage] = useState<string | null>(null);
  const [departementError, setDepartementError] = useState<string | null>(null);

  useEffect(() => {
    setSteps(cloneSteps(initialSteps));
    setBaseline(cloneSteps(initialSteps));
  }, [initialSteps]);

  useEffect(() => {
    setRoleList(roles.map((role) => ({ ...role })));
    setRoleBaseline(roles.map((role) => ({ ...role })));
    setRoleMessage(null);
    setRoleError(null);
  }, [roles]);

  useEffect(() => {
    setDepartementList(departements.map((dept) => ({ ...dept })));
    setDepartementBaseline(departements.map((dept) => ({ ...dept })));
    setDepartementMessage(null);
    setDepartementError(null);
  }, [departements]);

  const departementNames = useMemo(() => {
    const map = new Map<number, string>();
    departementList.forEach((dept) => {
      if (typeof dept.id === 'number') {
        const display = dept.name && dept.name.trim().length > 0 ? dept.name.trim() : `Dept ${dept.id}`;
        map.set(dept.id, display);
      }
    });
    return map;
  }, [departementList]);

  const roleMap = useMemo(() => {
    const map = new Map<number, EditionRole>();
    roleList.forEach((role) => {
      map.set(role.id, role);
    });
    return map;
  }, [roleList]);

  const roleOptions = useMemo(() => {
    const sorted = [...roleList].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return a.id - b.id;
    });
    return sorted.map((role) => {
      const deptName = role.departement_id ? departementNames.get(role.departement_id) : null;
      return {
        id: role.id,
        label: deptName ? `${role.name} · ${deptName}` : role.name,
      };
    });
  }, [roleList, departementNames]);

  const diagramDefinition = useMemo(() => {
    const lines: string[] = ['graph TD', '  start([Start])'];

    steps.forEach((step, index) => {
      const nodeId = `step_${index}`;
      const role = step.roleId != null ? roleMap.get(step.roleId) : undefined;
      const roleName = role?.name ?? '';
      const deptName = role?.departement_id ? departementNames.get(role.departement_id) : null;
      const labelParts = [step.title && step.title.trim() ? step.title.trim() : `Step ${index + 1}`];
      if (roleName) {
        labelParts.push(deptName ? `${roleName} · ${deptName}` : roleName);
      }
      const label = escapeMermaidLabel(labelParts.join('\n'));
      lines.push(`  ${nodeId}["${label}"]`);
    });

    lines.push('  finish([End])');

    if (steps.length === 0) {
      lines.push('  start --> finish');
    } else {
      lines.push('  start --> step_0');
      for (let i = 0; i < steps.length; i += 1) {
        if (i === steps.length - 1) {
          lines.push(`  step_${i} --> finish`);
        } else {
          lines.push(`  step_${i} --> step_${i + 1}`);
        }
      }
    }

    return lines.join('\n');
  }, [steps, roleMap, departementNames]);

  useEffect(() => {
    let cancelled = false;

    ensureMermaid()
      .then((mermaid) => {
        const renderResult = mermaid.render(`process-diagram-${processId}-${Date.now()}`, diagramDefinition);
        if (typeof (renderResult as Promise<any>).then === 'function') {
          return (renderResult as Promise<{ svg: string }>).then((res) => res.svg);
        }
        return (renderResult as { svg: string }).svg;
      })
      .then((svg) => {
        if (!cancelled) {
          setDiagramSvg(svg);
          setDiagramError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDiagramSvg(null);
          setDiagramError(err instanceof Error ? err.message : 'Unable to render diagram');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [diagramDefinition, processId]);

  const dirty = useMemo(() => {
    return JSON.stringify(steps) !== JSON.stringify(baseline);
  }, [steps, baseline]);

  function updateStep(id: string, patch: Partial<EditableStep>) {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...patch } : step))
    );
  }

  function moveStep(id: string, direction: -1 | 1) {
    setSteps((prev) => {
      const index = prev.findIndex((step) => step.id === id);
      if (index === -1) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: makeStepId(),
        title: `New step ${prev.length + 1}`,
        roleId: roleOptions[0]?.id ?? null,
      },
    ]);
    setSaveSuccess(null);
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((step) => step.id !== id));
    setSaveSuccess(null);
  }

  function resetChanges() {
    setSteps(cloneSteps(baseline));
    setSaveError(null);
    setSaveSuccess(null);
  }

  function roleBaselineFor(id: number) {
    return roleBaseline.find((item) => item.id === id);
  }

  function departementBaselineFor(id: number) {
    return departementBaseline.find((item) => item.id === id);
  }

  function updateRoleDraft(id: number, patch: Partial<EditionRole>) {
    setRoleList((prev) => prev.map((role) => (role.id === id ? { ...role, ...patch } : role)));
    setRoleMessage(null);
    setRoleError(null);
  }

  function resetRole(id: number) {
    const baselineRole = roleBaselineFor(id);
    if (!baselineRole) return;
    setRoleList((prev) => prev.map((role) => (role.id === id ? { ...baselineRole } : role)));
    setRoleMessage(null);
    setRoleError(null);
  }

  async function saveRole(id: number) {
    const role = roleList.find((item) => item.id === id);
    if (!role) return;
    const trimmedName = role.name.trim();
    if (!trimmedName) {
      setRoleError('Role name is required');
      return;
    }

    const payload: { name: string; departementId: number | null } = {
      name: trimmedName,
      departementId: role.departement_id ?? null,
    };

    setRolePendingId(id);
    setRoleError(null);
    setRoleMessage(null);
    try {
      const res = await fetch(`/api/org/roles/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update role');
      }

      const updated = (data?.role as EditionRole | undefined) ?? {
        ...role,
        name: trimmedName,
        departement_id: role.departement_id ?? null,
      };

      setRoleList((prev) => prev.map((item) => (item.id === id ? { ...updated } : item)));
      setRoleBaseline((prev) => {
        const exists = prev.some((item) => item.id === id);
        if (!exists) return [...prev, { ...updated }];
        return prev.map((item) => (item.id === id ? { ...updated } : item));
      });
      setRoleMessage('Role updated');
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { text: 'Role updated', kind: 'success' },
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      setRoleError(message);
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { text: message, kind: 'error' },
        })
      );
    } finally {
      setRolePendingId(null);
    }
  }

  function updateDepartementDraft(id: number, patch: Partial<EditionDepartement>) {
    setDepartementList((prev) => prev.map((dept) => (dept.id === id ? { ...dept, ...patch } : dept)));
    setDepartementMessage(null);
    setDepartementError(null);
  }

  function resetDepartement(id: number) {
    const baselineDept = departementBaselineFor(id);
    if (!baselineDept) return;
    setDepartementList((prev) => prev.map((dept) => (dept.id === id ? { ...baselineDept } : dept)));
    setDepartementMessage(null);
    setDepartementError(null);
  }

  async function saveDepartement(id: number) {
    const departement = departementList.find((item) => item.id === id);
    if (!departement) return;
    const trimmedName = (departement.name ?? '').trim();
    if (!trimmedName) {
      setDepartementError('Departement name is required');
      return;
    }

    setDepartementPendingId(id);
    setDepartementError(null);
    setDepartementMessage(null);
    try {
      const res = await fetch(`/api/org/departements/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update departement');
      }

      const updated = (data?.departement as EditionDepartement | undefined) ?? {
        ...departement,
        name: trimmedName,
      };

      setDepartementList((prev) => prev.map((item) => (item.id === id ? { ...updated } : item)));
      setDepartementBaseline((prev) => {
        const exists = prev.some((item) => item.id === id);
        if (!exists) return [...prev, { ...updated }];
        return prev.map((item) => (item.id === id ? { ...updated } : item));
      });
      setDepartementMessage('Departement updated');
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { text: 'Departement updated', kind: 'success' },
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update departement';
      setDepartementError(message);
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { text: message, kind: 'error' },
        })
      );
    } finally {
      setDepartementPendingId(null);
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const payload = {
        content: {
          version: 1,
          steps: steps.map((step) => ({
            id: step.id,
            title: step.title,
            roleId: step.roleId,
          })),
        },
      };

      const res = await fetch(`/api/processes/${processId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save changes');
      }

      setBaseline(cloneSteps(steps));
      setSaveSuccess('Process updated');
      router.refresh();
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { text: 'Process updated', kind: 'success' },
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save changes';
      setSaveError(message);
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { text: message, kind: 'error' },
        })
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card stack" style={{ gap: 16 }}>
        <header className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="stack" style={{ gap: 4 }}>
            <h3 style={{ margin: 0 }}>Steps</h3>
            <p className="muted" style={{ margin: 0 }}>
              Configure the linear flow for this process. It always starts at <strong>Start</strong> and finishes at <strong>End</strong>.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-outline" onClick={resetChanges} disabled={!dirty || saving}>
              Reset
            </button>
            <button className="btn" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </header>

        {saveError && (
          <p role="alert" className="error" style={{ color: 'var(--danger-color, #c00)', margin: 0 }}>
            {saveError}
          </p>
        )}
        {saveSuccess && !dirty && (
          <p role="status" className="success" style={{ color: 'var(--success-color, #0a0)', margin: 0 }}>
            {saveSuccess}
          </p>
        )}

        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
          {steps.map((step, index) => (
            <li key={step.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong>Step {index + 1}</strong>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => moveStep(step.id, -1)}
                    disabled={index === 0 || saving}
                    aria-label="Move step up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => moveStep(step.id, 1)}
                    disabled={index === steps.length - 1 || saving}
                    aria-label="Move step down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeStep(step.id)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <label className="stack" style={{ gap: 4 }}>
                <span>Title</span>
                <input
                  className="input"
                  value={step.title}
                  onChange={(event) => updateStep(step.id, { title: event.target.value })}
                  placeholder="Describe what happens during this step"
                  disabled={saving}
                />
              </label>

              <label className="stack" style={{ gap: 4 }}>
                <span>Role in charge</span>
                <select
                  className="select"
                  value={step.roleId == null ? '' : step.roleId.toString()}
                  onChange={(event) =>
                    updateStep(step.id, {
                      roleId: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                  disabled={saving || roleOptions.length === 0}
                >
                  <option value="">— No specific role —</option>
                  {step.roleId != null && !roleMap.has(step.roleId) && (
                    <option value={step.roleId}>Role #{step.roleId} (no longer available)</option>
                  )}
                  {roleOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-outline" onClick={addStep} disabled={saving}>
          Add step
        </button>
        {roleOptions.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            No roles found yet. Create roles from the Processes → Roles section to assign responsibilities.
          </p>
        )}
      </div>

      <div className="card stack" style={{ gap: 16 }}>
        <h3 style={{ margin: 0 }}>Roles</h3>
        <p className="muted" style={{ margin: 0 }}>
          Rename roles and move them between departments. Changes update the step selector instantly.
        </p>
        {roleError && (
          <p role="alert" className="error" style={{ color: 'var(--danger-color, #c00)', margin: 0 }}>
            {roleError}
          </p>
        )}
        {roleMessage && (
          <p role="status" className="success" style={{ color: 'var(--success-color, #0a0)', margin: 0 }}>
            {roleMessage}
          </p>
        )}
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
          {roleList.map((role) => {
            const baselineRole = roleBaselineFor(role.id);
            const dirty =
              !baselineRole ||
              baselineRole.name !== role.name ||
              baselineRole.departement_id !== role.departement_id;
            return (
              <li key={role.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="stack" style={{ gap: 4 }}>
                  <span>Name</span>
                  <input
                    className="input"
                    value={role.name}
                    onChange={(event) => updateRoleDraft(role.id, { name: event.target.value })}
                    disabled={rolePendingId === role.id}
                    required
                  />
                </label>
                <label className="stack" style={{ gap: 4 }}>
                  <span>Department</span>
                  <select
                    className="select"
                    value={role.departement_id == null ? '' : role.departement_id.toString()}
                    onChange={(event) =>
                      updateRoleDraft(role.id, {
                        departement_id: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                    disabled={rolePendingId === role.id}
                  >
                    <option value="">— No department —</option>
                    {departementList.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {departementNames.get(dept.id) ?? (dept.name && dept.name.trim().length > 0
                          ? dept.name.trim()
                          : `Dept ${dept.id}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => resetRole(role.id)}
                    disabled={!dirty || rolePendingId === role.id}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => saveRole(role.id)}
                    disabled={!dirty || rolePendingId === role.id}
                  >
                    {rolePendingId === role.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </li>
            );
          })}
          {roleList.length === 0 && <li className="muted">No roles available yet.</li>}
        </ul>
      </div>

      <div className="card stack" style={{ gap: 16 }}>
        <h3 style={{ margin: 0 }}>Departments</h3>
        <p className="muted" style={{ margin: 0 }}>
          Update department names to keep responsibilities aligned with your organisation.
        </p>
        {departementError && (
          <p role="alert" className="error" style={{ color: 'var(--danger-color, #c00)', margin: 0 }}>
            {departementError}
          </p>
        )}
        {departementMessage && (
          <p role="status" className="success" style={{ color: 'var(--success-color, #0a0)', margin: 0 }}>
            {departementMessage}
          </p>
        )}
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
          {departementList.map((dept) => {
            const baselineDept = departementBaselineFor(dept.id);
            const dirty = !baselineDept || (baselineDept.name ?? '') !== (dept.name ?? '');
            return (
              <li key={dept.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="stack" style={{ gap: 4 }}>
                  <span>Name</span>
                  <input
                    className="input"
                    value={dept.name ?? ''}
                    onChange={(event) => updateDepartementDraft(dept.id, { name: event.target.value })}
                    disabled={departementPendingId === dept.id}
                    required
                  />
                </label>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => resetDepartement(dept.id)}
                    disabled={!dirty || departementPendingId === dept.id}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => saveDepartement(dept.id)}
                    disabled={!dirty || departementPendingId === dept.id}
                  >
                    {departementPendingId === dept.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </li>
            );
          })}
          {departementList.length === 0 && <li className="muted">No departments found yet.</li>}
        </ul>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <h3 style={{ margin: 0 }}>Preview</h3>
        <p className="muted" style={{ margin: 0 }}>
          This Mermaid diagram refreshes automatically when you edit the steps of <strong>{processName}</strong>.
        </p>
        {diagramSvg && (
          <div
            role="img"
            aria-label={`Mermaid diagram for ${processName}`}
            dangerouslySetInnerHTML={{ __html: diagramSvg }}
          />
        )}
        {!diagramSvg && !diagramError && <p className="muted" style={{ margin: 0 }}>Rendering diagram…</p>}
        {diagramError && (
          <p role="alert" className="error" style={{ color: 'var(--danger-color, #c00)', margin: 0 }}>
            {diagramError}
          </p>
        )}
        <pre className="muted" style={{ margin: 0, overflowX: 'auto' }}>
{diagramDefinition}
        </pre>
      </div>
    </div>
  );
}
