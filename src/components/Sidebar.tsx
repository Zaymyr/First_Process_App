'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

type Item = { href: string; label: string; icon: string };

const TOP: Item[] = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/processes', label: 'Processes', icon: '🧩' },
  { href: '/org', label: 'Organization', icon: '🏢' },
  { href: '/org/members', label: 'Members', icon: '👥' },
  { href: '/org/invite', label: 'Invite', icon: '✉️' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const v = localStorage.getItem('sidebar:collapsed');
    setCollapsed(v === '1');
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar:collapsed', next ? '1' : '0');
      return next;
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login?toast=' + encodeURIComponent('Signed out') + '&kind=info';
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main navigation">
      <div className="sb-top">
        <button className="sb-toggle" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '»' : '«'}
        </button>
        {!collapsed && <span className="sb-title">Menu</span>}
      </div>

      <nav className="sb-nav">
        {TOP.map((it) => {
          const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href));
          return (
            <Link key={it.href} href={it.href} className={`nav-link ${active ? 'active' : ''}`}>
              <span className="nav-icon" aria-hidden>{it.icon}</span>
              <span className="nav-label">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sb-bottom">
        <button className="nav-link danger" onClick={logout}>
          <span className="nav-icon" aria-hidden>⎋</span>
          <span className="nav-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
