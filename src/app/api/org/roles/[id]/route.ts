import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function cookieClient() {
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
    } as any,
  );
}

type RouteCtx = { params: Promise<{ id: string }> } | { params: { id: string } };

async function resolveParams(ctx: RouteCtx): Promise<{ id: string }> {
  const params: any = (ctx as any).params;
  if (params && typeof params.then === 'function') return await params;
  return params as { id: string };
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id } = await resolveParams(ctx);
  const roleId = Number(id);
  if (!roleId || Number.isNaN(roleId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { name } = await req.json().catch(() => ({}));
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  const supabase = await cookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (membership.role !== 'owner' && membership.role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: role } = await supabase
    .from('roles')
    .select('id, organization_id')
    .eq('id', roleId)
    .maybeSingle();
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (role.organization_id !== membership.org_id) {
    return NextResponse.json({ error: 'Role not in your organization' }, { status: 400 });
  }

  const { error } = await supabase
    .from('roles')
    .update({ name: name.trim() })
    .eq('id', roleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
