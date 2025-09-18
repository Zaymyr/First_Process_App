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

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const supabase = await sb();
  const admin = adminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: mem } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!mem) return NextResponse.json({ error: 'No org' }, { status: 400 });

  const org_id = mem.org_id;
  const [{ data: sub }, { data: members }] = await Promise.all([
    admin.from('org_subscriptions').select('*').eq('org_id', org_id).maybeSingle(),
    admin.from('org_members').select('role').eq('org_id', org_id),
  ]);

  const hasActiveSub = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused');
  const m = (members ?? []) as Array<{ role: 'owner'|'editor'|'viewer' }>;
  const usedEditors = m.filter(x => x.role === 'owner' || x.role === 'editor').length;
  const usedViewers = m.filter(x => x.role === 'viewer').length;

  return NextResponse.json({
    org_id,
    subscription: sub ?? null,
    hasActiveSub,
    editors: { used: usedEditors, limit: hasActiveSub ? sub!.seats_editor : null },
    viewers: { used: usedViewers, limit: hasActiveSub ? sub!.seats_viewer : null },
  });
}
