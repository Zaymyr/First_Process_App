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
    <header className="spaced" style={{ height: 56 }}>
      <nav className="row" style={{ alignItems:'center', gap: 16 }}>
        {/* Mobile hamburger */}
        <button
          className="mobile-only btn btn-outline"
          aria-label="Ouvrir le menu"
          onClick={() => {
            if (typeof document !== 'undefined') {
              document.body.classList.toggle('sidebar-open');
            }
          }}
          style={{ padding: '6px 10px' }}
        >
          ☰
        </button>
        <Link href="/" className="brand" style={{ fontSize: 16 }}>First Process</Link>
        <Link href="/" className="link hide-mobile" aria-label="Home">Home</Link>
      </nav>
      <div>
        <AuthStatus />
      </div>
    </header>
  );
}
