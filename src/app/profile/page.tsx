import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    redirect('/login?next=' + encodeURIComponent('/profile'));
  }

  const email = user.email ?? null;
  const fullName = (user.user_metadata as any)?.full_name ?? '';

  return <ProfileClient email={email} initialFullName={fullName} />;
}
