'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

type Item = { href: string; label: string; icon: string };

const TOP: Item[] = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/processes', label: 'Processes', icon: '🧩' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [orgOpen, setOrgOpen] = useState<boolean>(true);
  const supabase = createClient();
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    const v = localStorage.getItem('sidebar:collapsed');
    setCollapsed(v === '1');
    const o = localStorage.getItem('sidebar:orgOpen');
    setOrgOpen(o !== '0');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: membership } = await supabase
        .from('org_members')
        .select('organizations(name)')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();
      const rel: any = membership?.organizations;
      const org = Array.isArray(rel) ? rel[0] : rel;
      setOrgName(org?.name ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    // Auto-open Organization group when on any /org route
    if (pathname.startsWith('/org')) setOrgOpen(true);
  }, [pathname]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar:collapsed', next ? '1' : '0');
      return next;
    });
  }

  function toggleOrg() {
    setOrgOpen((v) => {
      const next = !v;
      localStorage.setItem('sidebar:orgOpen', next ? '1' : '0');
      return next;
    });
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Navigation principale">
      <div className="sb-top">
        <button className="sb-toggle" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '»' : '«'}
        </button>
        {!collapsed && <span className="sb-title">{orgName ?? '—'}</span>}
      </div>

      <nav className="sb-nav">
        {TOP.map((it) => {
          const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`nav-link ${active ? 'active' : ''}`}
              onClick={() => {
                if (typeof document !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
                  document.body.classList.remove('sidebar-open');
                }
              }}
            >
              <span className="nav-icon" aria-hidden>{it.icon}</span>
              <span className="nav-label">{it.label}</span>
            </Link>
          );
        })}

        {/* Organization group */}
        <button
          type="button"
          className={`nav-link group-toggle ${pathname === '/org' ? 'active' : ''}`}
          onClick={toggleOrg}
          aria-expanded={orgOpen}
          aria-controls="sb-org-group"
        >
          <span className="nav-icon" aria-hidden>🏢</span>
          <span className="nav-label">Organization</span>
          <span className={`caret ${orgOpen ? 'open' : ''}`} aria-hidden>▾</span>
        </button>

        {orgOpen && (
          <div id="sb-org-group" className="subnav">
            {[
              { href: '/org/plan', label: 'Plan', icon: '📊' },
              { href: '/org/settings', label: 'Settings', icon: '⚙️' },
              { href: '/org/members', label: 'Members', icon: '👥' },
              { href: '/org/invite', label: 'Invite', icon: '✉️' },
            ].map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`nav-link sub ${active ? 'active' : ''}`}
                  onClick={() => {
                    if (typeof document !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
                      document.body.classList.remove('sidebar-open');
                    }
                  }}
                >
                  <span className="nav-icon" aria-hidden>{it.icon}</span>
                  <span className="nav-label">{it.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
