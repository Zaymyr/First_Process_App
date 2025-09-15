import { createClient } from '@/lib/supabase-server';
import Link from 'next/link';
import DepartementForm from '@/app/processes/DepartementForm';
import DepartementDeleteButton from '@/app/processes/parts/DepartementDeleteButton';

type Dept = { id: number; name: string | null; organization_id: string };

export const dynamic = 'force-dynamic';

export default async function DepartementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  const orgId: string | null = membership?.org_id ?? null;
  if (!orgId) return <p>No organization found for your account.</p>;

  const { data: departementsRaw } = await supabase
    .from('departements')
    .select('id, name, organization_id')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });
  const departements = (departementsRaw ?? []) as Dept[];

  return (
    <section className="stack" style={{ maxWidth: 800 }}>
      <h2>Departments</h2>
      <div className="card stack">
        <ul className="stack" style={{ gap: 6 }}>
          {departements.map((d) => (
            <li key={d.id} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div className="row" style={{ gap: 8 }}>
                <span>{d.name ?? `Dept ${d.id}`}</span>
                <Link className="link" href={`/processes/departements/${d.id}`}>Roles</Link>
              </div>
              <DepartementDeleteButton id={d.id} />
            </li>
          ))}
          {departements.length === 0 && <li className="muted">No departments yet.</li>}
        </ul>
        <DepartementForm />
      </div>
    </section>
  );
}
