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
        get: (n: string) => c.get(n)?.value,
        set: (n: string, v: string, o?: any) => c.set({ name: n, value: v, ...o }),
        remove: (n: string, o?: any) => c.set({ name: n, value: '', ...o }),
      },
    } as any
  );
}

type RouteCtx = { params: Promise<{ id: string }> } | { params: { id: string } };

async function resolveParams(ctx: RouteCtx): Promise<{ id: string }> {
  const p: any = (ctx as any).params;
  if (p && typeof p.then === 'function') return await p;
  return p as { id: string };
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id } = await resolveParams(ctx);
  const roleId = Number(id);
  if (!roleId || Number.isNaN(roleId)) {
    return NextResponse.json({ error: 'Invalid role id' }, { status: 400 });
  }

  const supabase = await cookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const nameRaw = typeof body.name === 'string' ? body.name.trim() : '';
    if (!nameRaw) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }
    updates.name = nameRaw;
  }

  let targetDepartement: number | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'departementId')) {
    if (body.departementId === null) {
      targetDepartement = null;
      updates.departement_id = null;
    } else {
      const depId = Number(body.departementId);
      if (!depId || Number.isNaN(depId)) {
        return NextResponse.json({ error: 'Invalid departement id' }, { status: 400 });
      }
      targetDepartement = depId;
      updates.departement_id = depId;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }
  if (membership.role !== 'owner' && membership.role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: role } = await supabase
    .from('roles')
    .select('id, organization_id')
    .eq('id', roleId)
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (role.organization_id !== membership.org_id) {
    return NextResponse.json({ error: 'Role not in your organization' }, { status: 400 });
  }

  if (targetDepartement) {
    const { data: departement } = await supabase
      .from('departements')
      .select('id, organization_id')
      .eq('id', targetDepartement)
      .maybeSingle();
    if (!departement || departement.organization_id !== membership.org_id) {
      return NextResponse.json({ error: 'Departement not in your organization' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('roles')
    .update(updates)
    .eq('id', roleId)
    .eq('organization_id', membership.org_id)
    .select('id, name, departement_id')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ role: data });
}
