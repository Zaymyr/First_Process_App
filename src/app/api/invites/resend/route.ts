import { NextResponse } from 'next/server';
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

export async function POST(req: Request) {
  const supabase = await cookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { inviteId } = await req.json();
  if (!inviteId) return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: inv } = await admin
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  const { data: me } = await admin
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
  // Always bounce through /auth/callback then into /auth/new-password for password setup
  const next = `/auth/new-password?inviteId=${inv.id}&em=${encodeURIComponent(inv.email)}`;
  const redirectTo = `${base}/auth/cb?next=${encodeURIComponent(next)}`;

  // D'abord tenter generateLink invite (si non confirmé)
  let mode: 'invite' | 'magic-link' = 'invite';
  let actionLink: string | null = null;
  const gen = await admin.auth.admin.generateLink({
    type: 'invite',
    email: inv.email,
    options: { redirectTo }
  });
  if (!gen.error && gen.data?.properties?.action_link) {
    actionLink = gen.data.properties.action_link;
  } else {
    // Fallback magiclink
    mode = 'magic-link';
    const genMagic = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: inv.email,
      options: { redirectTo }
    });
    if (!genMagic.error && genMagic.data?.properties?.action_link) {
      actionLink = genMagic.data.properties.action_link;
    } else {
      return NextResponse.json({ error: genMagic.error?.message || gen.error?.message || 'Unable to generate link' }, { status: 400 });
    }
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.4;margin:0;padding:0">
      <h2 style="margin:0 0 16px">Nouvelle invitation</h2>
      <p>L'invitation pour <strong>${inv.email}</strong> a été renvoyée.</p>
      <p>Cliquez ci-dessous pour ${mode === 'invite' ? 'confirmer votre email et rejoindre' : 'ouvrir une session et rejoindre'} :</p>
      <p style="text-align:center;margin:32px 0"><a href="${actionLink}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Continuer</a></p>
      <p style="font-size:12px;color:#666">Si le bouton ne fonctionne pas :<br/><span style="word-break:break-all;color:#444">${actionLink}</span></p>
    </div>`;
  const sent = await sendInviteEmail({ to: inv.email, html, text: actionLink! });
  if (!sent.ok) return NextResponse.json({ error: sent.reason }, { status: 500 });
  return NextResponse.json({ ok: true, emailMode: mode });
}
