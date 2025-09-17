import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: Request) {
  try {
    const c = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => c.get(name)?.value,
          set: (name: string, value: string, options?: any) => c.set({ name, value, ...options }),
          remove: (name: string, options?: any) => c.set({ name, value: '', ...options }),
        },
      } as any
    );

    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }

  const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host') || new URL(req.url).host;
    const proto = h.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '') || 'https';
    const origin = `${proto}://${host}`;
    const search = new URLSearchParams({ toast: 'Signed out', kind: 'info' }).toString();
    const url = new URL(`/login?${search}`, origin);
    return NextResponse.redirect(url);
  } catch {
    // Fallback minimal si quelque chose casse: redirection relative
    const loc = '/login?toast=Signed%20out&kind=info';
    return new Response(null, { status: 302, headers: { Location: loc } });
  }
}

export async function POST() {
  try {
    const c = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => c.get(name)?.value,
          set: (name: string, value: string, options?: any) => c.set({ name, value, ...options }),
          remove: (name: string, options?: any) => c.set({ name, value: '', ...options }),
        },
      } as any
    );

    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // On retourne quand même ok=false pour que le client puisse continuer la redirection
    return NextResponse.json({ ok: false, error: e?.message || 'logout failed' }, { status: 200 });
  }
}
