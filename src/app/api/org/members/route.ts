import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

export async function GET() {
  const supabase = await sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return NextResponse.json({ items: [] });

  const { data: items, error } = await supabase
    .from('org_members')
    .select('user_id, role, can_edit, users:auth.users(email)')
    .eq('org_id', membership.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const mapped = (items ?? []).map((r: any) => ({
    user_id: r.user_id,
    role: r.role,
    can_edit: r.can_edit,
    email: r.users?.email ?? null,
  }));

  return NextResponse.json({ items: mapped });
}

export async function PATCH(req: Request) {
  const supabase = await sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { user_id, role } = await req.json();

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!me || (me.role !== 'owner' && me.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Seats enforcement when changing role
  const [{ data: sub }, { data: members }, { data: target }] = await Promise.all([
    supabase.from('org_subscriptions').select('*').eq('org_id', me.org_id).maybeSingle(),
    supabase.from('org_members').select('user_id, role').eq('org_id', me.org_id),
    supabase.from('org_members').select('user_id, role').eq('org_id', me.org_id).eq('user_id', user_id).maybeSingle(),
  ]);
  const hasActiveSub = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused');

  if (target) {
    if (target.role !== role) {
      const usedEditors = (members ?? []).filter((m: any) => m.role === 'owner' || m.role === 'editor').length;
      const usedViewers = (members ?? []).filter((m: any) => m.role === 'viewer').length;
      if (hasActiveSub) {
        if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
          return NextResponse.json({ error: 'No editor seats available' }, { status: 409 });
        }
        if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
          return NextResponse.json({ error: 'No viewer seats available' }, { status: 409 });
        }
      }
    }
  }

  const { error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('user_id', user_id)
    .eq('org_id', me.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { user_id } = await req.json();

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!me || (me.role !== 'owner' && me.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('user_id', user_id)
    .eq('org_id', me.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
