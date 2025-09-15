import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { inviteId } = await req.json();

  // Read invite with admin client (bypass RLS), we'll still validate email below
  const { data: inv, error } = await admin
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();

  if (error || !inv) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  const email = (user.email ?? '').toLowerCase();
  if (inv.email.toLowerCase() !== email) {
    return NextResponse.json({ error: 'Invite email mismatch' }, { status: 403 });
  }

  // Fetch subscription and current members to enforce seats (admin client to bypass RLS)
  const [{ data: sub }, { data: members }, { data: existing }] = await Promise.all([
    admin.from('org_subscriptions').select('*').eq('org_id', inv.org_id).maybeSingle(),
    admin.from('org_members').select('user_id, role').eq('org_id', inv.org_id),
    admin.from('org_members').select('user_id, role').eq('org_id', inv.org_id).eq('user_id', user.id).maybeSingle(),
  ]);

  const hasActiveSub = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused');

  const list = (members ?? []) as Array<{ user_id: string; role: 'owner'|'editor'|'viewer' }>;
  const usedEditors = list.filter(m => m.role === 'owner' || m.role === 'editor').length;
  const usedViewers = list.filter(m => m.role === 'viewer').length;

  // If user already a member
  if (existing) {
    if (inv.role === 'editor' && existing.role === 'viewer') {
      if (hasActiveSub && usedEditors >= (sub!.seats_editor ?? 0)) {
        return NextResponse.json({ error: 'No editor seats available to upgrade' }, { status: 409 });
      }
      const { error: upErr } = await supabase
        .from('org_members')
        .update({ role: 'editor', can_edit: true })
        .eq('org_id', inv.org_id)
        .eq('user_id', user.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
    // If invite role is same or less, nothing else to do
  } else {
    // New membership: enforce seats for the invited role
    if (hasActiveSub) {
      if (inv.role === 'editor') {
        if (usedEditors >= (sub!.seats_editor ?? 0)) {
          return NextResponse.json({ error: 'No editor seats available' }, { status: 409 });
        }
      } else {
        if (usedViewers >= (sub!.seats_viewer ?? 0)) {
          return NextResponse.json({ error: 'No viewer seats available' }, { status: 409 });
        }
      }
    }

    const { error: mErr } = await supabase
      .from('org_members')
      .insert({
        org_id: inv.org_id,
        user_id: user.id,
        role: inv.role,
        can_edit: inv.role !== 'viewer',
      });

    if (mErr) {
      const msg = mErr.message?.toLowerCase() || '';
      const isDuplicate = msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('already exists');
      if (!isDuplicate) return NextResponse.json({ error: mErr.message }, { status: 400 });
    }
  }

  await supabase
    .from('invites')
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq('id', inviteId);

  return NextResponse.json({ ok: true });
}
