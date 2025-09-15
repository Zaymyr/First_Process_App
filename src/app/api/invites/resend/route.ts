import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

async function cookieClient() {
  const c = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => c.get(n)?.value,
        set: (n: string, v: string, o?: any) => c.set({ name: n, value: v, ...o }),
        remove: (n: string, o?: any) => c.set({ name: n, value: '', ...o }),
      },
    } as any
  );
}

export async function POST(req: Request) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { inviteId } = await req.json();
  if (!inviteId) return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: inv } = await admin
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  const { data: me } = await admin
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
  const redirectTo = `${base}/accept-invite?inviteId=${inv.id}`;

  const { error: resendErr } = await admin.auth.admin.inviteUserByEmail(inv.email, {
    redirectTo,
    data: { invited_role: inv.role },
  });
  if (resendErr) return NextResponse.json({ error: resendErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
