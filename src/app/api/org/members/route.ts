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

  // Use admin client to bypass RLS and avoid cross-schema join issues
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: items, error } = await admin
    .from('org_members')
    .select('user_id, role, can_edit')
    .eq('org_id', membership.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Fetch users' info via Admin API to avoid PostgREST auth.users limitations
  const ids = Array.from(new Set((items ?? []).map((r: any) => r.user_id).filter(Boolean)));
  const usersById: Record<string, { email: string | null; name: string | null }> = {};
  if (ids.length > 0) {
    const results = await Promise.all(
      ids.map(async (id: string) => {
        try {
          const { data, error } = await (admin as any).auth.admin.getUserById(id);
          if (error || !data?.user) return { id, email: null, name: null };
          const u = data.user as any;
          const meta = (u.user_metadata ?? u.raw_user_meta_data) || {};
          const name = meta.full_name || meta.name || null;
          const email = u.email ?? null;
          return { id, email, name };
        } catch {
          return { id, email: null, name: null };
        }
      })
    );
    for (const r of results) usersById[r.id] = { email: r.email, name: r.name };
  }

  const mapped = (items ?? []).map((r: any) => ({
    user_id: r.user_id,
    role: r.role,
    can_edit: r.can_edit,
    email: usersById[r.user_id]?.email ?? null,
    name: usersById[r.user_id]?.name ?? null,
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

  if (!me || me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Seats enforcement when changing role (bypass RLS with admin)
  const [{ data: sub }, { data: members }, { data: target }] = await Promise.all([
    admin.from('org_subscriptions').select('*').eq('org_id', me.org_id).maybeSingle(),
    admin.from('org_members').select('user_id, role').eq('org_id', me.org_id),
    admin.from('org_members').select('user_id, role').eq('org_id', me.org_id).eq('user_id', user_id).maybeSingle(),
  ]);
  const hasActiveSub = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused');

  if (target) {
    if (target.role !== role) {
      const usedEditors = (members ?? []).filter((m: any) => m.role === 'owner' || m.role === 'editor').length;
      const usedViewers = (members ?? []).filter((m: any) => m.role === 'viewer').length;
      if (hasActiveSub) {
        // Treat owner promotions as consuming an editor seat as well
        if ((role === 'editor' || role === 'owner') && usedEditors >= (sub!.seats_editor ?? 0)) {
          return NextResponse.json({ error: 'No creator seats available' }, { status: 409 });
        }
        if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
          return NextResponse.json({ error: 'No viewer seats available' }, { status: 409 });
        }
      }
      // Prevent demoting the last owner
      if (target.role === 'owner' && role !== 'owner') {
        const owners = (members ?? []).filter((m: any) => m.role === 'owner').length;
        if (owners <= 1) {
          return NextResponse.json({ error: 'Cannot demote the only owner' }, { status: 409 });
        }
      }
    }
  }

  const can_edit = role === 'editor' || role === 'owner';
  const { error } = await admin
    .from('org_members')
    .update({ role, can_edit })
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
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!me || me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (user_id === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself here' }, { status: 400 });
  }

  // Admin client pour bypass RLS et supprimer compte utilisateur
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Vérifier cible appartient bien à l'org et récupérer email
  const { data: targetMember } = await admin
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', me.org_id)
    .eq('user_id', user_id)
    .maybeSingle();
  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Protéger dernier owner
  if (targetMember.role === 'owner') {
    const { data: owners } = await admin
      .from('org_members')
      .select('user_id')
      .eq('org_id', me.org_id)
      .eq('role', 'owner');
    if ((owners ?? []).length <= 1) {
      return NextResponse.json({ error: 'Cannot remove the only owner' }, { status: 409 });
    }
  }

  // Récupérer email via admin auth (peut échouer silencieusement)
  let email: string | null = null;
  try {
    const { data: u } = await (admin as any).auth.admin.getUserById(user_id);
    email = (u?.user?.email ?? null) as string | null;
  } catch {}

  // Supprimer membership
  const { error: delMemErr } = await admin
    .from('org_members')
    .delete()
    .eq('org_id', me.org_id)
    .eq('user_id', user_id);
  if (delMemErr) return NextResponse.json({ error: delMemErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
