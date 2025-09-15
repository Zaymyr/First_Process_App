import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const AUTH_PAGES = ['/login', '/auth/callback', '/reset-password', '/accept-invite', '/set-password'];


function isAuthPage(pathname: string) {
  return AUTH_PAGES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;
  const pathname = nextUrl.pathname;

  if (
    isAuthPage(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets')
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookies.get(name)?.value,
        set: (name: string, value: string, options?: any) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options?: any) => {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    } as any
  );

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    // Exécuter sur toutes les routes sauf assets statiques et API
    '/((?!_next/static|_next/image|favicon.ico|assets|public|api|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)',
  ],
};
