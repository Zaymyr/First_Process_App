'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import AuthStatus from '@/components/AuthStatus';

const AUTH_PAGES = ['/login', '/auth/callback', '/reset-password'];

export default function AppHeader() {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  const supabase = createClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let stop = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!stop) setSignedIn(!!data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSignedIn(!!session);
    });
    return () => {
      sub.subscription.unsubscribe();
      stop = true;
    };
  }, [supabase]);

  // Encore indéterminé → ne pas clignoter
  if (signedIn === null) return null;

  // Cacher le header sur les pages d'auth UNIQUEMENT si non connecté
  if (isAuthPage && !signedIn) return null;

  return (
    <header style={{ display: 'flex', gap: 16, padding: 12, borderBottom: '1px solid #eee' }}>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link href="/">Home</Link>
        <Link href="/processes">Processes</Link>
        <Link href="/profile">Profile</Link>
      </nav>
      <div style={{ marginLeft: 'auto' }}>
        <AuthStatus />
      </div>
    </header>
  );
}
