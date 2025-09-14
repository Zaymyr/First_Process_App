'use client';
import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useState } from 'react';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get('inviteId') ?? '';
  const supabase = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState('Finishing your invite…');

  // Handle implicit flow: #access_token -> /auth/callback?access_token=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (location.hash && location.hash.startsWith('#access_token')) {
      const frag = new URLSearchParams(location.hash.slice(1));
      const q = new URLSearchParams();
      q.set('next', `/accept-invite?inviteId=${inviteId}`);
      for (const key of [
        'access_token','refresh_token','expires_in','expires_at','token_type','type','provider_token',
      ]) {
        const v = frag.get(key);
        if (v) q.set(key, v);
      }
      location.replace(`/auth/callback?${q.toString()}`);
      return;
    }
  }, [inviteId]);

  // Wait for session then accept invite
  useEffect(() => {
    let tries = 0;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (tries++ < 20) return setTimeout(run, 500); // ~10s
        setMsg('No session found. Please click the invite and set your password.');
        return;
      }
      setMsg('Accepting your invite…');
      const r = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j?.error || 'Failed to accept invite');
        return;
      }
      router.replace('/org?toast=' + encodeURIComponent('Invite accepted') + '&kind=success');
    };
    if (inviteId) run();
  }, [inviteId, supabase, router]);

  return (
    <section style={{display:'grid',gap:12,maxWidth:560}}>
      <h2>Finishing your invite…</h2>
      <p>{msg}</p>
      <div style={{display:'flex',gap:8}}>
        <a href="/login?next=/accept-invite">Sign in manually</a>
        <button onClick={() => location.reload()}>I finished setting my password — retry</button>
      </div>
    </section>
  );
}
