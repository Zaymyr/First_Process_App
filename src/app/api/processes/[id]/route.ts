// src/app/api/processes/[id]/route.ts
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
    } as any // ⬅️ satisfy TS for CookieMethodsServer with Next 15 cookies()
  );
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const supabase = await getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Load existing to get its org
    const { data: existing, error: loadErr } = await supabase
      .from('processes')
      .select('id, organization_id')
      .eq('id', id)
      .single();
    if (loadErr || !existing) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

    if (typeof body.organization_id !== 'undefined' && body.organization_id !== existing.organization_id) {
      return NextResponse.json({ error: 'organization_id cannot be changed' }, { status: 400 });
    }

    const patch: any = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.content !== 'undefined') patch.content = body.content;

    if (typeof body.departement_id !== 'undefined') {
      if (body.departement_id === null) {
        patch.departement_id = null;
      } else {
        const depId = Number(body.departement_id);
        if (!Number.isFinite(depId)) return NextResponse.json({ error: 'Invalid departement_id' }, { status: 400 });

        const { data: dep, error: depErr } = await supabase
          .from('departements')
          .select('organization_id')
          .eq('id', depId)
          .single();
        if (depErr || !dep) return NextResponse.json({ error: 'Departement not found' }, { status: 400 });
        if (dep.organization_id !== existing.organization_id) {
          return NextResponse.json({ error: 'Departement not in this process’s organization' }, { status: 400 });
        }
        patch.departement_id = depId;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await supabase.from('processes').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { error } = await supabase.from('processes').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
