'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Toast = { id: number; text: string; kind?: 'info' | 'success' | 'error' };

export default function Toaster() {
  const params = useSearchParams();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  // 1) Lire ?toast=... depuis l'URL et l’effacer ensuite
  useEffect(() => {
    const msg = params.get('toast');
    const kind = (params.get('kind') as Toast['kind']) || 'success';
    if (msg) {
      push({ text: decodeURIComponent(msg), kind });
      // retirer le param sans recharger la page
      const url = new URL(window.location.href);
      url.searchParams.delete('toast');
      url.searchParams.delete('kind');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // 2) Permettre des toasts in-app via un CustomEvent
  useEffect(() => {
    function onEvt(e: Event) {
      const detail = (e as CustomEvent).detail as { text: string; kind?: Toast['kind'] };
      if (detail?.text) push(detail);
    }
    window.addEventListener('toast', onEvt as any);
    return () => window.removeEventListener('toast', onEvt as any);
  }, []);

  function push(t: Omit<Toast, 'id'>) {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, ...t }]);
    // auto-hide after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  }

  if (!toasts.length) return null;

  return (
    <div style={{
  position: 'fixed',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'grid',
  gap: 8,
  zIndex: 9999
}}>

      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            display: 'inline-block',   // ✅ shrink to fit content
            maxWidth: '80vw',          // ✅ prevent overly long toasts
            wordWrap: 'break-word',    // ✅ wrap if too long
            boxShadow: '0 6px 24px rgba(0,0,0,.08)',
            background: t.kind === 'error' ? '#fee2e2'
                : t.kind === 'info' ? '#e0f2fe'
                : '#dcfce7',
            color: '#111',
            border: '1px solid rgba(0,0,0,.06)'
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
