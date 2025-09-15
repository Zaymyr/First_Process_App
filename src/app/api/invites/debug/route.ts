import { NextRequest, NextResponse } from 'next/server';
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

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await cookieClient();
  const admin = adminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const inviteId = url.searchParams.get('inviteId');
  if (!inviteId) return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });

  const { data: inv, error: invErr } = await admin
    .from('invites')
    .select('id, org_id, email, role, accepted_at, accepted_by, created_at')
    .eq('id', inviteId)
    .maybeSingle();
  if (invErr || !inv) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  // Ensure the requester belongs to the same org and is owner/editor
  const { data: me } = await admin
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me || (me.role !== 'owner' && me.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [{ data: sub }, { data: members }] = await Promise.all([
    admin.from('org_subscriptions').select('*').eq('org_id', inv.org_id).maybeSingle(),
    admin.from('org_members').select('user_id, role').eq('org_id', inv.org_id),
  ]);

  const list = (members ?? []) as Array<{ user_id: string; role: 'owner'|'editor'|'viewer' }>;
  const usedEditors = list.filter(m => m.role === 'owner' || m.role === 'editor').length;
  const usedViewers = list.filter(m => m.role === 'viewer').length;

  return NextResponse.json({
    invite: inv,
    subscription: sub ?? null,
    hasActiveSub: !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused'),
    counts: {
      usedEditors,
      usedViewers,
      seatsEditor: sub?.seats_editor ?? null,
      seatsViewer: sub?.seats_viewer ?? null,
      status: sub?.status ?? null,
    },
  });
}
