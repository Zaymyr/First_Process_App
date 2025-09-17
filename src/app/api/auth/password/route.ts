import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSbClient } from '@supabase/supabase-js';

async function sb() {
  const c = await cookies();
  return createServerClient(
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
}

export async function POST(req: Request) {
  const supabase = await sb();
  let { data: { user } } = await supabase.auth.getUser();

  // Fallback: autoriser un Bearer token si les cookies serveur ne sont pas encore en place
  let bearerClient: ReturnType<typeof createSbClient> | null = null;
  if (!user) {
    const authz = req.headers.get('authorization') || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const bearer = m[1];
      bearerClient = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          auth: { persistSession: false },
        }
      );
      const res = await bearerClient.auth.getUser();
      user = res.data.user;
    }
  }
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { password } = await req.json();
  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
  }

  // Utiliser le client qui possède la session valide
  const { error } = await (bearerClient ? bearerClient.auth.updateUser({ password }) : supabase.auth.updateUser({ password }));
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
