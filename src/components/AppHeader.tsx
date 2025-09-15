'use client';
import Link from 'next/link';
import AuthStatus from '@/components/AuthStatus';

export default function AppHeader() {
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
