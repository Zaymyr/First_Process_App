// src/app/api/invites/route.ts
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
function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { email, role }:{email:string;role:'editor'|'viewer'} = await req.json();
  if (!email || !['editor','viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Seats enforcement: get subscription and current usage (members + pending invites)
  const [{ data: sub }, { data: members }, { data: pendingInvites }] = await Promise.all([
    supabase.from('org_subscriptions').select('*').eq('org_id', me.org_id).maybeSingle(),
    supabase.from('org_members').select('role').eq('org_id', me.org_id),
    supabase.from('invites').select('role, accepted_at').eq('org_id', me.org_id).is('accepted_at', null),
  ]);
  // Apply seat checks only if a subscription exists (active)
  const hasActiveSub = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused');

  const listMembers = (members ?? []) as Array<{ role: 'owner'|'editor'|'viewer' }>; 
  const listPending = (pendingInvites ?? []) as Array<{ role: 'editor'|'viewer'; accepted_at: string|null }>; 

  const usedEditors = listMembers.filter(m => m.role === 'owner' || m.role === 'editor').length +
    listPending.filter(i => i.role === 'editor').length;
  const usedViewers = listMembers.filter(m => m.role === 'viewer').length +
    listPending.filter(i => i.role === 'viewer').length;

  if (hasActiveSub) {
    if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
      return NextResponse.json({ error: 'No editor seats available for this plan' }, { status: 409 });
    }
    if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
      return NextResponse.json({ error: 'No viewer seats available for this plan' }, { status: 409 });
    }
  }

  const { data: invite, error: invErr } = await supabase
    .from('invites')
    .insert({
      org_id: me.org_id,
      email: email.toLowerCase().trim(),
      role,
      invited_by: user.id,
    })
    .select('id')
    .single();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  const admin = adminClient();
  // Normalize base URL (remove trailing slashes)
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');

  // Rediriger directement vers /accept-invite pour capturer les tokens (#access_token) côté client
  const redirectTo = `${base}/accept-invite?inviteId=${invite.id}`;

  const { error: adminErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invited_role: role },
  });

  if (adminErr) {
    return NextResponse.json({ error: `Invite created but email failed: ${adminErr.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inviteId: invite.id });
}
