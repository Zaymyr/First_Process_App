"use client";
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function RecoveryDeprecated() {
  const sp = useSearchParams();
  useEffect(() => {
    const q = sp.toString();
    const next = `/auth/new-password${q ? `?${q}` : ''}`;
    window.location.replace(next);
  }, [sp]);
  return <p style={{ textAlign:'center', marginTop:80 }}>Redirection…</p>;
}
