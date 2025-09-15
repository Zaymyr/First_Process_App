import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import ProfileClient from '@/app/profile/ProfileClient';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    redirect('/login?next=' + encodeURIComponent('/profile'));
  }

  const email = user.email ?? null;
  const fullName = (user.user_metadata as any)?.full_name ?? '';

  // Fetch role in user's current org (single-org assumption)
  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  const rawRole = membership?.role ?? null;
  const role = rawRole === 'editor' ? 'creator' : rawRole; // rename for UI

  return <ProfileClient email={email} initialFullName={fullName} role={role} />;
}
