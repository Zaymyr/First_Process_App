import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient, type User } from '@supabase/supabase-js';

/*
 POST /api/invites/resend
 Objectif: renvoyer un email approprié pour une invitation existante (inviteId).

 Logique:
  - Vérifier l'invite (id, org) + que le current user est owner de l'org.
  - Récupérer l'utilisateur potentiel (email de l'invite) via listUsers.
  - Cas A: Aucun user -> on renvoie une nouvelle invitation (inviteUserByEmail) ou generateLink('invite').
  - Cas B: User existe mais non confirmé -> resend signup (auth.resend({ type:'signup'})).
  - Cas C: Confirmé sans mot de passe -> resetPasswordForEmail.
  - Cas D: Confirmé avec mot de passe -> envoi d'un magic link (signInWithOtp) pour faciliter l'accès direct.

 On retourne dans la réponse: { case, emailSent, generatedLink? }
*/

async function anonClient() {
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

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const anon = await anonClient();
  const { data: { user: current } } = await anon.auth.getUser();
  if (!current) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { inviteId } = await req.json();
  if (!inviteId) return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });

  const admin = adminClient();
  const { data: invite, error: invErr } = await admin
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: 'Already accepted' }, { status: 409 });

  // Vérifier owner
  const { data: member } = await admin
    .from('org_members')
    .select('role')
    .eq('org_id', invite.org_id)
    .eq('user_id', current.id)
    .maybeSingle();
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const email = (invite.email as string).toLowerCase();
  // Récupération éventuelle de l'utilisateur existant
  const { data: usersList, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1, page: 1, email } as any);
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existingUser: User | undefined = usersList?.users?.find(u => u.email?.toLowerCase() === email);

  // redirectTo cohérent avec le flux principal
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');
  const redirectTo = `${base}/auth/accept?inviteId=${invite.id}&em=${encodeURIComponent(email)}`;

  // Cas A: aucun user (on considère l'invite initiale perdue) -> renvoyer invitation comme neuf
  if (!existingUser) {
    const send = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (send.error) return NextResponse.json({ case: 'new-user', emailSent: false, note: send.error.message });
    const gen = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
    return NextResponse.json({ case: 'new-user', emailSent: true, generatedLink: gen.data?.properties?.action_link || null });
  }

  // Cas B: existant non confirmé
  if (!existingUser.email_confirmed_at) {
  const resend = await anon.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
    if (resend.error) return NextResponse.json({ case: 'unconfirmed-user', emailSent: false, note: resend.error.message });
    const gen = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
    return NextResponse.json({ case: 'unconfirmed-user', emailSent: true, generatedLink: gen.data?.properties?.action_link || null });
  }

  // Cas C: confirmé mais sans mot de passe
  const hasPassword = (existingUser.user_metadata as any)?.has_password === true;
  if (!hasPassword) {
  const reset = await anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (reset.error) return NextResponse.json({ case: 'confirmed-no-password', emailSent: false, note: reset.error.message });
    return NextResponse.json({ case: 'confirmed-no-password', emailSent: true });
  }

  // Cas D: confirmé avec mot de passe -> magic link (facilite connexion)
  const magic = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (magic.error) return NextResponse.json({ case: 'confirmed-with-password', emailSent: false, note: magic.error.message });
  return NextResponse.json({ case: 'confirmed-with-password', emailSent: true });
}
