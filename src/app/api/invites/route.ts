// src/app/api/invites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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

  const { email, role }:{email:string;role:'editor'|'viewer'} = await req.json();
  if (!email || !['editor','viewer'].includes(role)) {
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

  const listMembers = (members ?? []) as Array<{ role: 'owner'|'editor'|'viewer' }>; 
  const listPending = (pendingInvites ?? []) as Array<{ role: 'editor'|'viewer'; accepted_at: string|null }>; 

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

  async function findUserIdByEmail(target: string): Promise<string | null> {
    // Parcours des pages jusqu'à trouver (limite de sécurité 10 pages × 100 = 1000 users)
    for (let page = 1; page <= 10; page++) {
      try {
        const { data, error } = await (admin as any).auth.admin.listUsers({ perPage: 100, page });
        if (error) break;
        const users = data?.users || [];
        const match = users.find((u: any) => (u.email || '').toLowerCase() === target);
        if (match) return match.id;
        if (users.length < 100) break; // dernière page
      } catch {
        break;
      }
    }
    return null;
  }

  const existingUserId = await findUserIdByEmail(lowerEmail);

  if (existingUserId) {
    // Si déjà membre: éventuellement upgrade viewer->editor
    const { data: membership } = await admin
      .from('org_members')
      .select('user_id, role')
      .eq('org_id', me.org_id)
      .eq('user_id', existingUserId)
      .maybeSingle();
    if (membership) {
      // Upgrade logique similaire à accept
      if (membership.role !== role) {
        const usedEditors = listMembers.filter(m => m.role === 'owner' || m.role === 'editor').length;
        const usedViewers = listMembers.filter(m => m.role === 'viewer').length;
        if (hasActiveSub) {
          if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
            return NextResponse.json({ error: 'No editor seats available for upgrade' }, { status: 409 });
          }
          if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
            return NextResponse.json({ error: 'No viewer seats available for downgrade swap' }, { status: 409 });
          }
        }
        const can_edit = role !== 'viewer';
        const { error: upErr } = await admin
          .from('org_members')
          .update({ role, can_edit })
          .eq('org_id', me.org_id)
          .eq('user_id', existingUserId);
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, autoAccepted: true, userId: existingUserId });
    } else {
      // Nouveau membership direct sans invite
      const usedEditors = listMembers.filter(m => m.role === 'owner' || m.role === 'editor').length;
      const usedViewers = listMembers.filter(m => m.role === 'viewer').length;
      if (hasActiveSub) {
        if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
          return NextResponse.json({ error: 'No editor seats available' }, { status: 409 });
        }
        if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
          return NextResponse.json({ error: 'No viewer seats available' }, { status: 409 });
        }
      }
      const { error: insErr } = await admin
        .from('org_members')
        .insert({ org_id: me.org_id, user_id: existingUserId, role, can_edit: role !== 'viewer' });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, autoAccepted: true, userId: existingUserId });
    }
  }

  // Utilisateur n'existe pas encore -> créer une invite classique
  const { data: invite, error: invErr } = await supabase
    .from('invites')
    .insert({ org_id: me.org_id, email: lowerEmail, role, invited_by: user.id })
    .select('id')
    .single();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  // Normalize base URL
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');
  const redirectTo = `${base}/accept-invite?inviteId=${invite.id}`;
  const { error: adminErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { invited_role: role } });
  if (adminErr) {
    const msg = (adminErr.message || '').toLowerCase();
    const already = msg.includes('already been registered') || msg.includes('already registered');
    if (already) {
      // Fallback: trouver user, supprimer l'invite et créer membership direct
      const fallbackId = await findUserIdByEmail(lowerEmail);
      if (fallbackId) {
        // Supprime l'invite devenue inutile
        await admin.from('invites').delete().eq('id', invite.id);
        // Vérifier si déjà membre
        const { data: membership } = await admin
          .from('org_members')
          .select('user_id, role')
          .eq('org_id', me.org_id)
          .eq('user_id', fallbackId)
          .maybeSingle();
        if (!membership) {
          const usedEditors = listMembers.filter(m => m.role === 'owner' || m.role === 'editor').length;
          const usedViewers = listMembers.filter(m => m.role === 'viewer').length;
          if (hasActiveSub) {
            if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
              return NextResponse.json({ error: 'No editor seats available' }, { status: 409 });
            }
            if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
              return NextResponse.json({ error: 'No viewer seats available' }, { status: 409 });
            }
          }
          const { error: insErr } = await admin
            .from('org_members')
            .insert({ org_id: me.org_id, user_id: fallbackId, role, can_edit: role !== 'viewer' });
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
        } else if (membership.role !== role) {
          const usedEditors = listMembers.filter(m => m.role === 'owner' || m.role === 'editor').length;
          const usedViewers = listMembers.filter(m => m.role === 'viewer').length;
          if (hasActiveSub) {
            if (role === 'editor' && usedEditors >= (sub!.seats_editor ?? 0)) {
              return NextResponse.json({ error: 'No editor seats available for upgrade' }, { status: 409 });
            }
            if (role === 'viewer' && usedViewers >= (sub!.seats_viewer ?? 0)) {
              return NextResponse.json({ error: 'No viewer seats available for downgrade swap' }, { status: 409 });
            }
          }
          const can_edit = role !== 'viewer';
          const { error: upErr } = await admin
            .from('org_members')
            .update({ role, can_edit })
            .eq('org_id', me.org_id)
            .eq('user_id', fallbackId);
          if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, autoAccepted: true, userId: fallbackId, viaFallback: true });
      }
    }
    return NextResponse.json({ error: `Invite created but email failed: ${adminErr.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inviteId: invite.id, autoAccepted: false });
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
