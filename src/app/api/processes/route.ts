// src/app/api/processes/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function getSupabase() {
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
    } as any // satisfy TS with Next 15 cookies()
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await getSupabase();

    // must be signed in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // client sends only { name, departement_id? }
    const name: string | undefined = body?.name?.toString().trim();
    const departement_id: number | null =
      typeof body?.departement_id === 'number' ? body.departement_id : null;

    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    // derive user's single organization
    const { data: membership, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (memErr || !membership) {
      return NextResponse.json({ error: 'No organization for this user' }, { status: 400 });
    }
    const organization_id: string = membership.org_id;

    // validate department belongs to that org (if provided)
    if (departement_id !== null) {
      const { data: dep, error: depErr } = await supabase
        .from('departements')
        .select('organization_id')
        .eq('id', departement_id)
        .single();

      if (depErr || !dep) return NextResponse.json({ error: 'Invalid departement' }, { status: 400 });
      if (dep.organization_id !== organization_id) {
        return NextResponse.json({ error: 'Departement not in your organization' }, { status: 400 });
      }
    }

    const payload: any = {
      name,
      organization_id,   // derived, not from client
      departement_id,
      content: {},
      owner_id: user.id,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from('processes')
      .insert(payload)
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
