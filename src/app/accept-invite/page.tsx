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
  useEffect(() => {
    let tries = 0;
    const tick = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // we have a session -> accept invite
        setStatus('accepting');
        const res = await fetch('/api/invites/accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inviteId }),
        });
        const j = await res.json();
        if (!res.ok) {
          setErr(j?.error || 'Failed to accept invite');
          setStatus('error');
          return;
        }
        setStatus('done');
        router.replace('/org?toast=' + encodeURIComponent('Invite accepted') + '&kind=success');
        return;
      }
      tries += 1;
      if (tries < 20) setTimeout(tick, 500); // retry up to ~10s
      else setErr('No session found. Please go back to the email and finish setting your password.');
    };
    if (inviteId) tick();
  }, [inviteId, supabase, router]);

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
