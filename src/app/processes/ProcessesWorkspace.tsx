'use client';

import { useEffect, useMemo, useState } from 'react';
import ProcessForm from './ProcessForm';
import ProcessItem from './ProcessItem';
import ProcessPreview from './parts/ProcessPreview';

export type Org = { id: string; name: string | null };
export type Dept = { id: number; name: string | null; organization_id: string };
export type Proc = {
  id: string;
  name: string;
  organization_id: string;
  departement_id: number | null;
  updated_at: string | null;
};

export default function ProcessesWorkspace({
  org,
  departements,
  processes,
}: {
  org: Org;
  departements: Dept[];
  processes: Proc[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(processes[0]?.id ?? null);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('processes-panel:open');
    if (stored !== null) {
      setPanelOpen(stored === '1');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('processes-panel:open', panelOpen ? '1' : '0');
  }, [panelOpen]);

  const selectedProcess = useMemo(
    () => processes.find((p) => p.id === selectedId) ?? null,
    [selectedId, processes]
  );

  return (
    <section className="processes-layout">
      <div className="processes-canvas">
        <ProcessPreview process={selectedProcess} departements={departements} />
      </div>

      <aside className={`processes-dock ${panelOpen ? '' : 'collapsed'}`} aria-label="Manage processes">
        <div className="processes-dock-header">
          <div className="processes-dock-info">
            <span className="processes-dock-icon" aria-hidden>
              🧩
            </span>
            {panelOpen && (
              <div className="processes-dock-heading">
                <h2 className="processes-dock-title">Processes</h2>
                <p className="processes-dock-subtitle muted">
                  {org.name ? `Organisation: ${org.name}` : 'Organisation sans nom'}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="processes-dock-toggle"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls="processes-panel-content"
          >
            <span aria-hidden>{panelOpen ? '›' : '‹'}</span>
            <span className="sr-only">{panelOpen ? 'Collapse panel' : 'Expand panel'}</span>
          </button>
        </div>

        <div
          id="processes-panel-content"
          className="processes-dock-content"
          aria-hidden={!panelOpen}
        >
          <section className="processes-dock-section">
            <header className="processes-dock-section-header">
              <h3>Existing processes</h3>
              <span className="muted" aria-live="polite">
                {processes.length} {processes.length === 1 ? 'process' : 'processes'}
              </span>
            </header>
            <ul className="processes-list stack">
              {processes.map((p) => (
                <ProcessItem
                  key={p.id}
                  item={p}
                  departements={departements}
                  selected={selectedId === p.id}
                  onSelect={(id) => setSelectedId(id)}
                />
              ))}
              {processes.length === 0 && (
                <li className="processes-empty muted">No process yet. Create one below.</li>
              )}
            </ul>
          </section>

          <section className="processes-dock-section">
            <header className="processes-dock-section-header">
              <h3>Create a process</h3>
            </header>
            <ProcessForm orgId={org.id} departements={departements} />
          </section>
        </div>
      </aside>
    </section>
  );
}
