import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/';

  // prepare redirect
  const res = NextResponse.redirect(new URL(next, url.origin));

  // bind cookies between request and response
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

  // ⬅️ IMPORTANT: pass the full query string
  await supabase.auth.exchangeCodeForSession(url.searchParams.toString());

  return res;
}
