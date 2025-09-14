'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get('inviteId') ?? '';
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<'waiting'|'accepting'|'done'|'error'>('waiting');
  const [err, setErr] = useState<string | null>(null);

  // Try to detect a session for a few seconds (user might still be on Supabase "Set password")
  // at top of file you already have 'use client' and imports

useEffect(() => {
  // If Supabase sent implicit tokens in the URL fragment, convert them to query and
  // bounce through /auth/callback so the server can set cookies.
  if (typeof window === 'undefined') return;
  if (location.hash && location.hash.startsWith('#access_token')) {
    const frag = new URLSearchParams(location.hash.slice(1)); // drop the '#'
    const q = new URLSearchParams();

    // where to go after cookies are set
    q.set('next', `/accept-invite?inviteId=${inviteId}`);

    // copy useful fields from fragment to query
    for (const key of [
      'access_token',
      'refresh_token',
      'expires_in',
      'expires_at',
      'token_type',
      'type',
      'provider_token',
    ]) {
      const v = frag.get(key);
      if (v) q.set(key, v);
    }

    // replace so back button isn't messy
    location.replace(`/auth/callback?${q.toString()}`);
    return;
  }
}, [inviteId]);


  return (
    <section style={{display:'grid',gap:12,maxWidth:520}}>
      <h2>Finishing your invite…</h2>
      {!inviteId && <p>Invalid invite link.</p>}
      {status === 'waiting' && (
        <p>Waiting for your session… If you haven’t seen it yet, use the email link to set your password, then return here.</p>
      )}
      {status === 'accepting' && <p>Accepting your invite…</p>}
      {status === 'done' && <p>Done! Redirecting…</p>}
      {err && <p style={{color:'crimson'}}>{err}</p>}
      <div style={{display:'flex',gap:8}}>
        <a href="/login?next=/accept-invite">Sign in manually</a>
        <button onClick={() => location.reload()}>I finished setting my password — retry</button>
      </div>
    </section>
  );
}
