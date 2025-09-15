import { createClient } from '@/lib/supabase-server';
import RolesManager from '@/app/processes/parts/RolesManager.tsx';

type Dept = { id: number; name: string | null };

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  const orgId = membership?.org_id as string | undefined;
  if (!orgId) return <p>No organization found for your account.</p>;

  const { data: depsRaw } = await supabase
    .from('departements')
    .select('id, name')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });
  const deps = (depsRaw ?? []) as Dept[];

  return (
    <section className="stack" style={{ maxWidth: 800 }}>
      <h2>Roles</h2>
      <RolesManager deps={deps} />
    </section>
  );
}
