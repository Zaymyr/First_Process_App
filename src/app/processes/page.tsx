// src/app/processes/page.tsx
import ProcessForm from './ProcessForm';
import ProcessItem from './ProcessItem';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

type Org = { id: string; name: string | null };
type Dept = { id: number; name: string | null; organization_id: string };
type Proc = {
  id: string;
  name: string;
  organization_id: string;
  departement_id: number | null;
  updated_at: string | null;
};

export default async function ProcessesPage() {
  const supabase = await createClient();
    
  const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/login');;

  // Single org for this user
  // Fetch exactly one membership and expand its organization
const { data: membership } = await supabase
  .from('org_members')
  .select('org_id, organizations:organizations(id,name)')
  .eq('user_id', user.id)
  .limit(1)
  .maybeSingle();

// organizations can come back as object or array depending on shape; normalize:
const orgRel: unknown = (membership as any)?.organizations;
const org: Org | null = Array.isArray(orgRel)
  ? (orgRel[0] ?? null)
  : ((orgRel as Org) ?? null);

if (!org) {
  return (
    <section>
      <h2>Processes</h2>
      <p>
        Aucune organisation liée à votre compte. Ajoutez une ligne dans{' '}
        <code>org_members</code> pour cet utilisateur.
      </p>
    </section>
  );
}


  // Departments for that org only
  const { data: departementsRaw } = await supabase
    .from('departements')
    .select('id,name,organization_id')
    .eq('organization_id', org.id)
    .order('name', { ascending: true });

  const departements = (departementsRaw ?? []) as Dept[];

  // Processes list (RLS already restricts by org membership; we filter by org too)
  const { data: processesRaw } = await supabase
    .from('processes')
    .select('id,name,organization_id,departement_id,updated_at')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(100);

  const processes = (processesRaw ?? []) as Proc[];

  return (
    <section className="stack" style={{ maxWidth: 920 }}>
      <h2>Processes</h2>

      <div className="card">
        <ProcessForm orgId={org.id} departements={departements} />
      </div>

      <ul className="stack" style={{ marginTop: 4 }}>
        {processes.map((p) => (
          <ProcessItem key={p.id} item={p} departements={departements} />
        ))}
        {processes.length === 0 && <li>Aucun process accessible.</li>}
      </ul>
    </section>
  );
}
