// Server route that exchanges the Supabase auth code for a session
// and sets cookies, then redirects to ?next=... (or / by default).
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/';

  const res = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options?: any) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name: string, options?: any) =>
          res.cookies.set({ name, value: '', ...options }),
      },
    } as any
  );

  // This reads the `code` and friends from the query string and sets the session cookie
  await supabase.auth.exchangeCodeForSession(url.searchParams);

  return res;
}
