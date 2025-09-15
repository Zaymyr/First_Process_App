'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

type Org = { id: string; name: string | null };

export default function AuthStatus() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const userIdRef = useRef<string | null>(null);

  async function fetchOrg(userId: string) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('organizations(id,name)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const rel: any = membership?.organizations;
    const theOrg: Org | null = Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
    setOrg(theOrg);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setSignedIn(!!session);
      setUserEmail(session?.user?.email ?? null);
      setUserName((session?.user?.user_metadata as any)?.full_name ?? null);
      userIdRef.current = session?.user?.id ?? null;

      if (session?.user?.id) {
        await fetchOrg(session.user.id);
      } else {
        setOrg(null);
      }
      setLoading(false);
    })();
  }, [supabase]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_ev, session) => {
      setSignedIn(!!session);
      setUserEmail(session?.user?.email ?? null);
      setUserName((session?.user?.user_metadata as any)?.full_name ?? null);
      userIdRef.current = session?.user?.id ?? null;

      if (session?.user?.id) {
        await fetchOrg(session.user.id);
      } else {
        setOrg(null);
      }
      router.refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    setSignedIn(false);
    setOrg(null);
    // 🔴 redirect vers /login directement
    window.location.href = '/login?toast=' + encodeURIComponent('Signed out') + '&kind=info';
      }

  if (loading) return null;
  if (!signedIn) return null;

  return (
    <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <strong>{org?.name ?? '—'}</strong>
      <span>{userName ?? userEmail}</span>
      <button onClick={logout}>Logout</button>
    </span>
  );
}
