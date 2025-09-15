import { createClient } from '@/lib/supabase-server';
import RoleForm from '../../parts/RoleForm';
import RoleDeleteButton from '../../parts/RoleDeleteButton';

type Role = { id: number; name: string; departement_id: number };

export const dynamic = 'force-dynamic';

export default async function DeptRolesPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const depId = Number(params.id);
  if (!depId || Number.isNaN(depId)) return <p>Invalid department id.</p>;

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

  // Ensure department exists and belongs to org
  const { data: dep } = await supabase
    .from('departements')
    .select('id, name, organization_id')
    .eq('id', depId)
    .maybeSingle();
  if (!dep || dep.organization_id !== orgId) return <p>Department not found.</p>;

  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, name, departement_id')
    .eq('departement_id', depId)
    .order('name', { ascending: true });
  const roles = (rolesRaw ?? []) as Role[];

  return (
    <section className="stack" style={{ maxWidth: 800 }}>
      <h2>Roles · {dep.name ?? `Dept ${dep.id}`}</h2>
      <div className="card stack">
        <ul className="stack" style={{ gap: 6 }}>
          {roles.map((r) => (
            <li key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span>{r.name}</span>
              <RoleDeleteButton departementId={depId} roleId={r.id} />
            </li>
          ))}
          {roles.length === 0 && <li className="muted">No roles yet.</li>}
        </ul>
        <RoleForm departementId={depId} />
      </div>
    </section>
  );
}
