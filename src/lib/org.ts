import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

type Org = { id: string; name: string | null };
type Member = { user_id: string; role: 'owner'|'editor'|'viewer' };

export async function getOrgContext() {
  const supabase = await createClient();

  // session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, org: null, sub: null, counts: null };

  // membership + organization (normalize array/object relation)
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, organizations(id,name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const rel: unknown = (membership as any)?.organizations;
  const org: Org | null = Array.isArray(rel) ? (rel[0] ?? null) : ((rel as Org) ?? null);
  if (!org) return { user, org: null, sub: null, counts: null };

  const [{ data: sub }, { data: members }] = await Promise.all([
    supabase.from('org_subscriptions').select('*').eq('org_id', org.id).maybeSingle(),
    // Use admin client to bypass RLS for accurate counts
    createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      .from('org_members')
      .select('user_id, role')
      .eq('org_id', org.id),
  ]);

  // owners count as editors (usual pricing)
  const list = (members ?? []) as Member[];
  const owners = list.filter(m => m.role === 'owner').length;
  const editors = list.filter(m => m.role === 'editor' || m.role === 'owner').length;
  const viewers = list.filter(m => m.role === 'viewer').length;

  return {
    user,
    org,
    sub,
    counts: {
      owners,
      editors,
      viewers,
      ownersMax: sub?.seats_editor ?? 0,
      editorsMax: sub?.seats_editor ?? 0,
      viewersMax: sub?.seats_viewer ?? 0,
    },
  };
}
