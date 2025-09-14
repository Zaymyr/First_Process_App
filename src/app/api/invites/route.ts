// src/app/api/invites/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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
    } as any
  );
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,    // server-only
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { email, role }:{email:string;role:'editor'|'viewer'} = await req.json();
  if (!email || !['editor','viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Who is inviting? Must belong to an org and be owner/editor
  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (!(me.role === 'owner' || me.role === 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create an invite row (to store desired role + track acceptance)
  const { data: invite, error: invErr } = await supabase
    .from('invites')
    .insert({
      org_id: me.org_id,
      email: email.toLowerCase().trim(),
      role,
      invited_by: user.id,
    })
    .select('id')
    .single();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  // Send Supabase ADMIN invite (email) with redirect to our accept page
  const admin = adminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite?inviteId=${invite.id}`;
  const { error: adminErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    // optional: preset profile data
    data: { invited_role: role }
  });
  if (adminErr) {
    return NextResponse.json({ error: `Invite created but email failed: ${adminErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
