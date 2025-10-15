import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import ProcessEditionClient, {
  EditableStep,
  EditionDepartement,
  EditionRole,
} from './ProcessEditionClient';

export const dynamic = 'force-dynamic';

type DbProcess = {
  id: string;
  name: string;
  organization_id: string;
  departement_id: number | null;
  content: unknown;
};

type StoredContent = {
  steps?: Array<{
    id?: unknown;
    title?: unknown;
    roleId?: unknown;
  }>;
};

function parseProcessSteps(raw: unknown): EditableStep[] {
  if (!raw) return [];

  let content: StoredContent | null = null;
  if (typeof raw === 'string') {
    try {
      content = JSON.parse(raw) as StoredContent;
    } catch (error) {
      console.warn('Unable to parse process content JSON', error);
      return [];
    }
  } else if (typeof raw === 'object' && raw !== null) {
    content = raw as StoredContent;
  }

  if (!content || !Array.isArray(content.steps)) {
    return [];
  }

  const seen = new Set<string>();
  const parsed: EditableStep[] = [];

  content.steps.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const idRaw = typeof item.id === 'string' ? item.id.trim() : '';
    const fallbackId = `step-${index + 1}`;
    const id = idRaw && !seen.has(idRaw) ? idRaw : fallbackId;
    seen.add(id);
    const title = typeof item.title === 'string' ? item.title : `Step ${index + 1}`;
    const roleId = typeof item.roleId === 'number' ? item.roleId : null;
    parsed.push({ id, title, roleId });
  });

  return parsed;
}

export default async function EditionPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const orgId = membership?.org_id as string | undefined;
  if (!orgId) {
    notFound();
  }

  const { data: process } = await supabase
    .from('processes')
    .select('id,name,organization_id,departement_id,content')
    .eq('id', params.id)
    .maybeSingle();

  if (!process || (process as DbProcess).organization_id !== orgId) {
    notFound();
  }

  const fullProcess = process as DbProcess;

  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id,name,departement_id')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });
  const roles = (rolesRaw ?? []) as EditionRole[];

  const { data: depsRaw } = await supabase
    .from('departements')
    .select('id,name')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });
  const departements = (depsRaw ?? []) as EditionDepartement[];

  const displayName = fullProcess.name ?? 'Untitled process';
  const initialSteps = parseProcessSteps(fullProcess.content);

  return (
    <section className="stack" style={{ maxWidth: 980 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Edition · {displayName}</h2>
        <Link className="btn btn-outline" href="/processes">
          ← Back to processes
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Define the steps for this process, assign roles, and preview the Mermaid diagram in real time.
      </p>

      <ProcessEditionClient
        processId={fullProcess.id}
        processName={displayName}
        initialSteps={initialSteps}
        roles={roles}
        departements={departements}
      />
    </section>
  );
}
