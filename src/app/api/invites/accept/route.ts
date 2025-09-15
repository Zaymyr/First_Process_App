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

export async function POST(req: Request) {
  const supabase = await sb();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { inviteId } = await req.json();

  const { data: inv, error } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();

  if (error || !inv) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  const email = (user.email ?? '').toLowerCase();
  if (inv.email.toLowerCase() !== email) {
    return NextResponse.json({ error: 'Invite email mismatch' }, { status: 403 });
  }

  const { error: mErr } = await supabase
    .from('org_members')
    .insert({
      org_id: inv.org_id,
      user_id: user.id,
      role: inv.role,
      can_edit: inv.role !== 'viewer',
    });
  // If already a member (unique constraint), treat as success (idempotent)
  if (mErr) {
    const msg = mErr.message?.toLowerCase() || '';
    const isDuplicate = msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('already exists');
    if (!isDuplicate) return NextResponse.json({ error: mErr.message }, { status: 400 });
  }

  await supabase
    .from('invites')
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq('id', inviteId);

  return NextResponse.json({ ok: true });
}
