'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const inviteId = params.get('inviteId') ?? '';

  const [msg, setMsg] = useState('Checking…');

  useEffect(() => {
    (async () => {
      if (!inviteId) {
        setMsg('Invalid invite link');
        return;
      }

      // Ensure we have a session (user clicked invite & set a password)
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Not logged in yet (very unlikely with admin invite), force login then come back
        router.replace(`/login?next=/accept-invite?inviteId=${encodeURIComponent(inviteId)}`);
        return;
      }

      // Auto-accept: attach user to org (DB trigger enforces seat limits / email match)
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const j = await res.json();

      if (!res.ok) {
        setMsg(j?.error || 'Failed to accept invite');
        return;
      }

      setMsg('Invite accepted ✅');
      router.replace('/org?toast=' + encodeURIComponent('Invite accepted') + '&kind=success');
    })();
  }, [inviteId, router, supabase]);

  return <p>{msg}</p>;
}
