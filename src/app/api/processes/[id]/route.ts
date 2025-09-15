// src/app/api/processes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// helper to get a Supabase server client bound to request cookies
async function sb(res?: { setCookie: (name: string, value: string, options?: any) => void }) {
  const c = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => c.get(name)?.value,
        set: (name: string, value: string, options?: any) => {
          c.set({ name, value, ...options });
          res?.setCookie?.(name, value, options);
        },
        remove: (name: string, options?: any) => {
          c.set({ name, value: '', ...options });
        },
      },
    } as any
  );
}

// GET one process
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await sb();
  const { data, error } = await supabase.from('processes').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? null);
}

// PATCH update process
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = await sb();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership || !(membership.role === 'owner' || membership.role === 'editor')) {
    return NextResponse.json({ error: 'Forbidden: creators/owners only' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.departement_id !== 'undefined') update.departement_id = body.departement_id;
  if (typeof body.content !== 'undefined') update.content = body.content;

  const { error } = await supabase.from('processes').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE process
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership || !(membership.role === 'owner' || membership.role === 'editor')) {
    return NextResponse.json({ error: 'Forbidden: creators/owners only' }, { status: 403 });
  }
  const { error } = await supabase.from('processes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
