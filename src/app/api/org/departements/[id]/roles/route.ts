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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const depId = Number(params.id);
  if (!depId || Number.isNaN(depId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });

  const { data: dep } = await supabase
    .from('departements')
    .select('id, organization_id')
    .eq('id', depId)
    .maybeSingle();
  if (!dep || dep.organization_id !== me.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('departement_roles')
    .select('id, name, departement_id')
    .eq('departement_id', depId)
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const depId = Number(params.id);
  if (!depId || Number.isNaN(depId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner' && me.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: dep } = await supabase
    .from('departements')
    .select('id, organization_id')
    .eq('id', depId)
    .maybeSingle();
  if (!dep || dep.organization_id !== me.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('departement_roles')
    .insert({ departement_id: depId, name: name.trim() })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const depId = Number(params.id);
  if (!depId || Number.isNaN(depId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const { roleId } = await req.json().catch(() => ({}));
  const rid = Number(roleId);
  if (!rid || Number.isNaN(rid)) return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 });

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner' && me.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: dep } = await supabase
    .from('departements')
    .select('id, organization_id')
    .eq('id', depId)
    .maybeSingle();
  if (!dep || dep.organization_id !== me.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('departement_roles')
    .delete()
    .eq('id', rid)
    .eq('departement_id', depId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
