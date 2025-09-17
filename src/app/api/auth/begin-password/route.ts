import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const { email, inviteId } = await req.json();
  if (!email) return NextResponse.json({ error: 'missing email' }, { status: 400 });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get() { return undefined; }, set() { }, remove() { } } } as any
  );
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');
  const next = `/auth/new-password?em=${encodeURIComponent(email)}${inviteId ? `&inviteId=${inviteId}` : ''}`;
  const redirectTo = `${base}/auth/cb?next=${encodeURIComponent(next)}`;
  // always trigger a password reset (recovery) email
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, redirectTo });
}
