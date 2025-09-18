// src/app/api/invites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendInviteEmail } from '@/lib/mailer';

async function cookieClient() {
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
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { email, role }: { email: string; role: 'editor' | 'viewer' } = await req.json();
  if (!email || !['editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Seats enforcement: get subscription and current usage (members + pending invites)
  const [{ data: sub }, { data: members }, { data: pendingInvites }] = await Promise.all([
    supabase.from('org_subscriptions').select('*').eq('org_id', me.org_id).maybeSingle(),
    supabase.from('org_members').select('role').eq('org_id', me.org_id),
    supabase.from('invites').select('role, accepted_at').eq('org_id', me.org_id).is('accepted_at', null),
  ]);
  // Apply seat checks only if a subscription exists (active)
  const hasActiveSub = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused');

  const listMembers = (members ?? []) as Array<{ role: 'owner' | 'editor' | 'viewer' }>;
  const listPending = (pendingInvites ?? []) as Array<{ role: 'editor' | 'viewer'; accepted_at: string | null }>;

  const usedEditors = listMembers.filter(m => m.role === 'owner' || m.role === 'editor').length +
    listPending.filter(i => i.role === 'editor').length;
  const usedViewers = listMembers.filter(m => m.role === 'viewer').length +
    listPending.filter(i => i.role === 'viewer').length;

  if (hasActiveSub) {
    if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
      return NextResponse.json({ error: 'No editor seats available for this plan' }, { status: 409 });
    }
    if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
      return NextResponse.json({ error: 'No viewer seats available for this plan' }, { status: 409 });
    }
  }

  const admin = adminClient();
  const lowerEmail = email.toLowerCase().trim();

  // Vérifier si un membre existe déjà dans l'org
  const { data: existingMembership } = await admin
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', me.org_id)
    .eq('user_id', lowerEmail) // volontairement faux pour éviter match (emails != user_id). Placeholder homogénéité.
    .limit(1);
  // (On ne peut pas deviner user_id à partir de l'email sans lister les users — choisi de ne plus auto-ajouter.)

  // Empêcher duplication d'invite pendante pour même email
  const { data: existingPending } = await admin
    .from('invites')
    .select('id')
    .eq('org_id', me.org_id)
    .eq('email', lowerEmail)
    .is('accepted_at', null)
    .limit(1);
  if (existingPending && existingPending.length > 0) {
    return NextResponse.json({ ok: true, inviteId: existingPending[0].id, duplicate: true, autoAccepted: false });
  }

  // Utilisateur n'existe pas encore -> créer une invite classique
  const { data: invite, error: invErr } = await supabase
    .from('invites')
    .insert({ org_id: me.org_id, email: lowerEmail, role, invited_by: user.id })
    .select('id')
    .single();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  // Normalisation de l'URL de redirection
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');
  const nextPath = `/auth/new-password?inviteId=${invite.id}&em=${encodeURIComponent(lowerEmail)}`;
  const redirectTo = `${base}/auth/cb?next=${encodeURIComponent(nextPath)}`;

  // Tentative 1 : generateLink type 'invite' (nouvel utilisateur)
  let mode: 'invite' | 'magic-link' = 'invite';
  const gen = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo }
  });

  let actionLink: string | null = null;
  if (!gen.error && gen.data?.properties?.action_link) {
    actionLink = gen.data.properties.action_link;
  } else {
    // Fallback : utilisateur existe déjà -> magic link
    mode = 'magic-link';
    const genMagic = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo }
    });
    if (!genMagic.error && genMagic.data?.properties?.action_link) {
      actionLink = genMagic.data.properties.action_link;
    } else {
      return NextResponse.json({ ok: true, inviteId: invite.id, emailSent: false, emailMode: mode, note: 'Link generation failed: ' + (genMagic.error?.message || gen.error?.message) });
    }
  }

  // Envoi email custom
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.4;margin:0;padding:0">
      <h2 style="margin:0 0 16px">Invitation à rejoindre l'organisation</h2>
      <p>Vous avez été invité(e) à rejoindre l'organisation de <strong>${user.email}</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour ${mode === 'invite' ? 'activer votre compte et définir' : 'ouvrir une session et définir / mettre à jour'} votre mot de passe.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${actionLink}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Rejoindre maintenant</a>
      </p>
      <p style="font-size:12px;color:#666">Si le bouton ne fonctionne pas, copiez-collez ce lien :<br />
        <span style="word-break:break-all;color:#444">${actionLink}</span></p>
      <p style="font-size:12px;color:#999">Ce lien expirera après utilisation ou dans un délai limité.</p>
    </div>
  `;
  const sent = await sendInviteEmail({ to: email, html, text: `Rejoindre : ${actionLink}` });
  if (!sent.ok) {
    return NextResponse.json({ ok: true, inviteId: invite.id, emailSent: false, emailMode: mode, note: sent.reason });
  }
  return NextResponse.json({ ok: true, inviteId: invite.id, emailSent: true, emailMode: mode });
}

export async function GET(req: NextRequest) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: me } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: 'No org' }, { status: 400 });
  if (me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: invites, error } = await supabase
    .from('invites')
    .select('id, email, role, created_at, accepted_at, accepted_by')
    .eq('org_id', me.org_id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ invites: invites ?? [] });
}
