"use client";
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthHashBridge() {
  const sp = useSearchParams();
  useEffect(() => {
    const next = sp.get('next') || '/';
    const baseCallback = '/auth/callback';
    const url = new URL(window.location.href);
    const search = url.searchParams;

    // If we already have a code or token/type in query, just forward to callback.
    if (search.get('code') || (search.get('token') && search.get('type'))) {
      const q = new URLSearchParams(search.toString());
      q.set('next', next);
      window.location.replace(`${baseCallback}?${q.toString()}`);
      return;
    }

    // Extract fragment tokens if present
    if (location.hash.startsWith('#')) {
      const hashParams = new URLSearchParams(location.hash.slice(1));
      if (hashParams.get('access_token') && hashParams.get('refresh_token')) {
        const q = new URLSearchParams();
        q.set('access_token', hashParams.get('access_token')!);
        q.set('refresh_token', hashParams.get('refresh_token')!);
        const extraKeys = ['expires_in','expires_at','token_type','type','provider_token'];
        extraKeys.forEach(k => { const v = hashParams.get(k); if (v) q.set(k, v); });
        q.set('next', next);
        window.location.replace(`${baseCallback}?${q.toString()}`);
        return;
      }
    }

    // Fallback: nothing usable -> go directly to next (will likely show error + allow resend)
    window.location.replace(next);
  }, [sp]);

  return (
    <main style={{ display:'grid', placeItems:'center', minHeight:'60vh' }}>
      <p>Connexion…</p>
    </main>
  );
}
