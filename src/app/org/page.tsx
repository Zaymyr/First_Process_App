import { createClient } from '@/lib/supabase-server';
import { getOrgContext } from '@/lib/org';
import OrgNameForm from './OrgNameForm';

export default async function OrgPage() {
  const supabase = await createClient();
  const { user, org, sub, counts } = await getOrgContext();
  if (!user) return null;
  if (!org) return <p>No organization found for your account.</p>;

  return (
    <section style={{display:'grid', gap:12, maxWidth:640}}>
      <h2>Organization</h2>
      <OrgNameForm initial={org.name ?? ''} />

      <div style={{marginTop:12, padding:12, border:'1px solid #eee'}}>
        <h3>Plan</h3>
        <p>{sub?.plan_id ?? '—'} · status: {sub?.status ?? '—'}</p>
        <p>Owners: {counts?.owners}/{counts?.ownersMax} · Creators: {counts?.editors}/{counts?.editorsMax} · Viewers: {counts?.viewers}/{counts?.viewersMax}</p>
      </div>

      <div style={{display:'flex', gap:12}}>
        <a href="/org/members">Manage members</a>
        <a href="/org/invite">Invite users</a>
      </div>
    </section>
  );
}
