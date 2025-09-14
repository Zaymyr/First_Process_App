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

  const params = url.searchParams;

  if (params.get('code')) {
    // PKCE/code flow
    await supabase.auth.exchangeCodeForSession(params.toString());
  } else if (params.get('access_token') && params.get('refresh_token')) {
    // Implicit flow (tokens came in the fragment, we moved them to query)
    await supabase.auth.setSession({
      access_token: params.get('access_token')!,
      refresh_token: params.get('refresh_token')!,
    });
  }
  return res;
}
