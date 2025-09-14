// src/app/processes/actions.ts
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';

const processSchema = z.object({
  name: z.string().min(1),
  organization_id: z.string().uuid(),
  departement_id: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.number().int().optional()
  ),
});

export async function loadData() {
  const supabase = await createClient();

  // utilisateur (si pas connecté => on renvoie des listes vides)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, orgs: [], processes: [] as any[] };
  }

  // Orgs de l'utilisateur (via RLS sur org_members)
  const { data: memberships, error: memErr } = await supabase
    .from('org_members')
    .select('org_id, organizations(id, name)')
    .order('org_id', { ascending: true });

  if (memErr) throw memErr;

  const orgs = (memberships ?? [])
    .map((m: any) => m.organizations)
    .filter(Boolean);

  // Processes visibles (RLS: seulement ceux des orgs où il est membre)
  const { data: processes, error: procErr } = await supabase
    .from('processes')
    .select('id, name, organization_id, departement_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (procErr) throw procErr;

  return { user, orgs, processes };
}

export async function createProcess(formData: FormData) {
  const supabase = await createClient();

  const parsed = processSchema.parse({
    name: formData.get('name')?.toString(),
    organization_id: formData.get('organization_id')?.toString(),
    departement_id: formData.get('departement_id')?.toString(),
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload: any = {
    name: parsed.name,
    organization_id: parsed.organization_id, // ⚠️ nécessaire pour que la policy passe
    departement_id: parsed.departement_id ?? null,
    content: {},                // tu rempliras plus tard
    owner_id: user.id,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('processes')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
