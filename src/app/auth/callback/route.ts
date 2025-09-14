// src/app/auth/callback/route.ts
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
        get: (n: string) => req.cookies.get(n)?.value,
        set: (n: string, v: string, o?: any) => res.cookies.set({ name: n, value: v, ...o }),
        remove: (n: string, o?: any) => res.cookies.set({ name: n, value: '', ...o }),
      },
    } as any
  );

  const params = url.searchParams;
  if (params.get('code')) {
    // Code/PKCE flow
    await supabase.auth.exchangeCodeForSession(params.toString());
  } else if (params.get('access_token') && params.get('refresh_token')) {
    // Implicit flow (we passed tokens via query)
    await supabase.auth.setSession({
      access_token: params.get('access_token')!,
      refresh_token: params.get('refresh_token')!,
    });
  }
  return res;
}
