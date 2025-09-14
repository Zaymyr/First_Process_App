// src/app/accept-invite/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

type Phase = 'checking' | 'need-session' | 'password' | 'accepting' | 'done' | 'error';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteId = params.get('inviteId') ?? '';
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>('checking');
  const [msg, setMsg] = useState<string>('Finishing your invite…');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // 1) If Supabase sent implicit tokens in the URL fragment, bounce through /auth/callback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (location.hash && location.hash.startsWith('#access_token')) {
      const frag = new URLSearchParams(location.hash.slice(1)); // drop '#'
      const q = new URLSearchParams();
      q.set('next', `/accept-invite?inviteId=${inviteId}`);
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
      location.replace(`/auth/callback?${q.toString()}`);
    }
  }, [inviteId]);

  // 2) Wait for a valid session; once we have one, show the password form
  useEffect(() => {
    let tries = 0;
    let stop = false;

    const waitForSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (stop) return;

      if (data.session) {
        // grab email for hint
        const u = data.session.user;
        setEmail(u?.email ?? null);
        setPhase('password'); // show set password form
        return;
      }

      if (tries++ < 20) {
        setTimeout(waitForSession, 500); // retry ~10s
      } else {
        setPhase('need-session');
        setMsg('No session found. Please click the invite again and set your password (or sign in).');
      }
    };

    if (inviteId) waitForSession();
    return () => {
      stop = true;
    };
  }, [inviteId, supabase]);

  // 3) After password is set, accept the invite and go to /org
  const onSetPasswordAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteId) return;
    if (!password || password !== confirm) {
      setMsg('Passwords do not match.');
      setPhase('error');
      return;
    }

    try {
      setBusy(true);
      setMsg('Setting your password…');

      // set password for the authenticated user
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) {
        setMsg(upErr.message);
        setPhase('error');
        setBusy(false);
        return;
      }

      setMsg('Accepting your invite…');
      setPhase('accepting');
      const resp = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        setMsg(j?.error || 'Failed to accept invite.');
        setPhase('error');
        setBusy(false);
        return;
      }

      setPhase('done');
      router.replace('/org?toast=' + encodeURIComponent('Welcome! Your password is set and you joined the org.') + '&kind=success');
    } catch (err: any) {
      setMsg(err?.message || 'Unexpected error.');
      setPhase('error');
      setBusy(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
      <h2>Finishing your invite…</h2>

      {phase === 'checking' && <p>Checking your session…</p>}

      {phase === 'need-session' && (
        <>
          <p style={{ color: 'crimson' }}>{msg}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/login?next=/accept-invite">Sign in manually</a>
            <button onClick={() => location.reload()}>I finished setting my password — retry</button>
          </div>
        </>
      )}

      {phase === 'password' && (
        <>
          <p>{email ? `Hi ${email}, set a password to finish joining.` : 'Set a password to finish joining.'}</p>
          <form onSubmit={onSetPasswordAndAccept} style={{ display: 'grid', gap: 8 }}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Working…' : 'Set password & join'}
            </button>
          </form>
        </>
      )}

      {phase === 'accepting' && <p>Accepting your invite…</p>}
      {phase === 'done' && <p>Done — redirecting…</p>}
      {phase === 'error' && <p style={{ color: 'crimson' }}>{msg}</p>}
    </section>
  );
}
