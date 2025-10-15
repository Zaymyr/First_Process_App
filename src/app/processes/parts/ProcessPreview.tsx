'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dept, Proc } from '../ProcessesWorkspace';

type Props = {
  process: Proc | null;
  departements: Dept[];
};

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    definition: string,
    container?: HTMLElement
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
};

let mermaidReady = false;
let mermaidLoading: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid can only run in the browser'));
  }

  const globalMermaid = (window as unknown as { mermaid?: MermaidApi }).mermaid;
  if (globalMermaid) {
    return Promise.resolve(globalMermaid);
  }

  if (!mermaidLoading) {
    mermaidLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        const instance = (window as unknown as { mermaid?: MermaidApi }).mermaid;
        if (!instance) {
          reject(new Error('Mermaid failed to load'));
          return;
        }
        resolve(instance);
      };
      script.onerror = () => reject(new Error('Mermaid script failed to load'));
      document.head.appendChild(script);
    });
  }

  return mermaidLoading;
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"').trim();
}

function buildDefinition(process: Proc, departements: Dept[]): string {
  const dept = process.departement_id
    ? departements.find((d) => d.id === process.departement_id) ?? null
    : null;

  const title = escapeMermaidLabel(process.name);
  const deptLabel = dept ? escapeMermaidLabel(dept.name ?? `Dept ${dept.id}`) : null;
  const nodeLabel = deptLabel ? `${title}\\n${deptLabel}` : title;

  return [
    'graph TD',
    '  start([Start])',
    `  step_0["${nodeLabel}"]`,
    '  finish([End])',
    '  start --> step_0',
    '  step_0 --> finish',
  ].join('\n');
}

function MermaidDiagram({ definition }: { definition: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const renderId = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let canceled = false;

    async function renderDiagram() {
      try {
        const mermaid = await loadMermaid();
        if (canceled) return;
        if (!mermaidReady) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
          mermaidReady = true;
        }
        const { svg } = await mermaid.render(renderId.current, definition);
        if (canceled) return;
        if (stageRef.current) {
          stageRef.current.innerHTML = svg;
        }
        setError(null);
      } catch (err) {
        if (canceled) return;
        if (stageRef.current) {
          stageRef.current.innerHTML = '';
        }
        setError(err instanceof Error ? err.message : 'Unable to render Mermaid diagram');
      }
    }

    if (stageRef.current) {
      stageRef.current.innerHTML = '';
    }
    renderDiagram();

    return () => {
      canceled = true;
    };
  }, [definition]);

  return (
    <div className="processes-preview-stage">
      <div ref={stageRef} className="processes-diagram" aria-hidden={!!error} />
      {error && (
        <div className="processes-diagram-error" role="alert">
          <p>{error}</p>
          <pre>{definition}</pre>
        </div>
      )}
    </div>
  );
}

export default function ProcessPreview({ process, departements }: Props) {
  const definition = useMemo(
    () => (process ? buildDefinition(process, departements) : null),
    [process, departements]
  );

  const updatedText = useMemo(() => {
    if (!process?.updated_at) return null;
    return new Date(process.updated_at).toISOString().replace('T', ' ').slice(0, 19);
  }, [process?.updated_at]);

  const deptName = useMemo(() => {
    if (!process?.departement_id) return 'No department';
    const found = departements.find((d) => d.id === process.departement_id);
    return found?.name ?? `Dept ${process.departement_id}`;
  }, [process, departements]);

  return (
    <div className="process-preview card stack" style={{ gap: 16 }}>
      <header className="stack" style={{ gap: 6 }}>
        <h2>{process ? process.name : 'Process preview'}</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          {process
            ? 'This Mermaid diagram refreshes automatically for the selected process.'
            : 'Select a process on the right to generate its Mermaid diagram.'}
        </p>
      </header>

      {definition ? (
        <MermaidDiagram definition={definition} />
      ) : (
        <div className="processes-preview-stage">
          <div className="processes-preview-empty">
            <p>No process selected yet.</p>
            <p>Create or choose a process from the right-hand panel to see its flow.</p>
          </div>
        </div>
      )}

      {process && (
        <div className="processes-preview-meta">
          <span>{deptName}</span>
          {updatedText && (
            <span>
              Last update: <time dateTime={process.updated_at ?? ''}>{updatedText}</time>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
