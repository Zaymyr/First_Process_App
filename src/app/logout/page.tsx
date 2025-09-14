// src/app/logout/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function LogoutPage() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
router.replace('/?toast=' + encodeURIComponent('Signed out') + '&kind=info');
router.refresh();

  }
  return <button onClick={signOut}>Sign out</button>;
}
