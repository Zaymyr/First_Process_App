'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AuthStatus from '@/components/AuthStatus';

const AUTH_PAGES = ['/login', '/auth/callback', '/reset-password'];

export default function AppHeader() {
  const pathname = usePathname();
  const isAuth = AUTH_PAGES.some(p => pathname.startsWith(p));
  if (isAuth) return null; // hide header on auth pages

  return (
    <header style={{ display: "flex", gap: 16, padding: 12, borderBottom: "1px solid #eee" }}>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/">Home</Link>
        <Link href="/processes">Processes</Link>
        <Link href="/profile">Profile</Link>
      </nav>
      <div style={{ marginLeft: "auto" }}>
        <AuthStatus />
      </div>
    </header>
  );
}
