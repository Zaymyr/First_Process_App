'use client';
import { usePathname } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import Sidebar from '@/components/Sidebar';
import SidebarBackdrop from '@/components/SidebarBackdrop';
import Toaster from '@/components/Toaster';

const AUTH_PAGES = ['/login', '/auth/callback', '/auth/recovery', '/auth/new-password', '/reset-password', '/accept-invite', '/set-password'];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return (
      <>
        <div className="site-header">
          <div className="container inner">
            <div className="brand" style={{ fontSize: 16 }}>First Process</div>
          </div>
        </div>
        <main>
          <div className="container">{children}</div>
        </main>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <div className="site-header">
        <div className="container inner"><AppHeader /></div>
      </div>
      <div className="with-sidebar">
        <Sidebar />
        <main>
          <div className="container">{children}</div>
        </main>
      </div>
      <SidebarBackdrop />
      <Toaster />
    </>
  );
}
