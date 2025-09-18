import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient, type User } from '@supabase/supabase-js';

/*
 Trois cas gérés dans cette route POST /api/invites :

 1. Nouvel utilisateur (aucun user avec cet email) -> on crée une ligne dans la table invites puis
    on utilise auth.admin.inviteUserByEmail(email, { redirectTo }) pour que Supabase envoie son email "Set your password".
    Alternative illustrée : auth.admin.generateLink({ type: 'invite', email }) si on veut construire / envoyer nous-même.

 2. Utilisateur existant mais non confirmé (user.email_confirmed_at null) -> renvoi d'email de confirmation :
    auth.resend({ type: 'signup', email, options: { emailRedirectTo } }).
    (On peut aussi regénérer un nouveau lien avec auth.admin.generateLink({ type:'invite' }).)

 3. Utilisateur confirmé mais sans mot de passe (user_metadata.has_password !== true) -> on envoie un email de reset :
    auth.resetPasswordForEmail(email, { redirectTo }) pour permettre de définir un mot de passe.

 Notes:
  - redirectTo: on garde un passage par /auth/cb?next=... afin d'unifier la création de session côté client si nécessaire.
  - Table invites: conserve le rattachement org + rôle, même si l'utilisateur existe déjà.
  - On ne crée pas automatiquement un membership tant que l'invitation n'est pas acceptée.
*/

async function createAnonClient() {
  const c = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => c.get(n)?.value,
        set: (n: string, v: string, o?: any) => c.set({ name: n, value: v, ...o }),
        remove: (n: string, o?: any) => c.set({ name: n, value: '', ...o }),
      },
    } as any
  );
}

function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type Role = 'viewer' | 'editor';

export async function POST(req: Request) {
  const anon = await createAnonClient();
  const { data: { user: current } } = await anon.auth.getUser();
  if (!current) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { email, role }: { email: string; role: Role } = await req.json();
  if (!email || !['viewer', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Récupérer l'org du demandeur (on suppose un seul org actif)
  const { data: me, error: meErr } = await anon
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', current.id)
    .maybeSingle();
  if (meErr || !me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdmin();
  const targetEmail = email.trim().toLowerCase();

  // Chercher si un utilisateur existe déjà (email unique)
  const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1, page: 1, email: targetEmail } as any);
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existingUser: User | undefined = existingUsers?.users?.find(u => u.email?.toLowerCase() === targetEmail);

  // Vérifier si invitation déjà pendante
  const { data: existingInvite } = await admin
    .from('invites')
    .select('id, accepted_at')
    .eq('org_id', me.org_id)
    .eq('email', targetEmail)
    .is('accepted_at', null)
    .maybeSingle();
  if (existingInvite) {
    return NextResponse.json({ ok: true, duplicate: true, inviteId: existingInvite.id });
  }

  // Créer/insérer l'invite interne (toujours, même si user existe déjà)
  const { data: inviteRow, error: invErr } = await anon
    .from('invites')
    .insert({ org_id: me.org_id, email: targetEmail, role, invited_by: current.id })
    .select('id')
    .single();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  // Construire redirectTo commun
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');
  const redirectTo = `${base}/auth/accept?inviteId=${inviteRow.id}&em=${encodeURIComponent(targetEmail)}`;

  // CAS 1: Nouvel utilisateur
  if (!existingUser) {
    const r = await admin.auth.admin.inviteUserByEmail(targetEmail, { redirectTo });
    if (r.error) return NextResponse.json({ ok: true, inviteId: inviteRow.id, emailSent: false, case: 'new-user', note: r.error.message });

    // Optionnel : montrer comment générer le lien d'invitation sans l'envoyer automatiquement
    const gen = await admin.auth.admin.generateLink({ type: 'invite', email: targetEmail, options: { redirectTo } });
    return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'new-user', emailSent: true, generatedLink: gen.data?.properties?.action_link || null });
  }

  // CAS 2: Utilisateur existant non confirmé
  if (!existingUser.email_confirmed_at) {
    // Relancer email de confirmation
  const resend = await anon.auth.resend({ type: 'signup', email: targetEmail, options: { emailRedirectTo: redirectTo } });
    if (resend.error) return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'unconfirmed-user', emailSent: false, note: resend.error.message });

    // Générer (option démonstration) un nouveau lien d'invitation si besoin d'un envoi custom SMTP
    const gen = await admin.auth.admin.generateLink({ type: 'invite', email: targetEmail, options: { redirectTo } });
    return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'unconfirmed-user', emailSent: true, generatedLink: gen.data?.properties?.action_link || null });
  }

  // CAS 3: Utilisateur confirmé mais sans mot de passe
  const hasPassword = (existingUser.user_metadata as any)?.has_password === true;
  if (!hasPassword) {
  const reset = await anon.auth.resetPasswordForEmail(targetEmail, { redirectTo });
    if (reset.error) return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'confirmed-no-password', emailSent: false, note: reset.error.message });
    return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'confirmed-no-password', emailSent: true });
  }

  // Si l'utilisateur est confirmé ET a déjà un mot de passe, on peut choisir de lui envoyer un magic link pour le connecter directement.
  const magic = await anon.auth.signInWithOtp({ email: targetEmail, options: { emailRedirectTo: redirectTo } });
  if (magic.error) return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'confirmed-with-password', emailSent: false, note: magic.error.message });
  return NextResponse.json({ ok: true, inviteId: inviteRow.id, case: 'confirmed-with-password', emailSent: true });
}

// GET: liste des invitations de l'org du current user (simple)
export async function GET(req: NextRequest) {
  const anon = await createAnonClient();
  const { data: { user: current } } = await anon.auth.getUser();
  if (!current) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: me } = await anon
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', current.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: invites, error } = await anon
    .from('invites')
    .select('id, email, role, created_at, accepted_at, accepted_by')
    .eq('org_id', me.org_id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invites: invites ?? [] });
}
