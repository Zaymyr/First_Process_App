import { createClient } from '@/lib/supabase-server';
import { getOrgContext } from '@/lib/org';
import OrgNameForm from './OrgNameForm';

export default async function OrgPage() {
  const supabase = await createClient();
  const { user, org, sub, counts } = await getOrgContext();
  if (!user) return null;
  if (!org) return <p>No organization found for your account.</p>;

  const ownersFull = counts && counts.ownersMax !== undefined ? counts.owners >= (counts.ownersMax ?? 0) : false;
  const editorsFull = counts && counts.editorsMax !== undefined ? counts.editors >= (counts.editorsMax ?? 0) : false;
  const viewersFull = counts && counts.viewersMax !== undefined ? counts.viewers >= (counts.viewersMax ?? 0) : false;

  return (
    <section className="stack" style={{maxWidth:640}}>
      <h2>Organization</h2>
      <OrgNameForm initial={org.name ?? ''} />

      <div className="card" style={{marginTop:12}}>
        <h3>Plan</h3>
        <p className="muted">{sub?.plan_id ?? '—'} · status: {sub?.status ?? '—'}</p>
        <p>
          Owners: <span className={`tag ${ownersFull ? 'full' : 'ok'}`}>{counts?.owners}/{counts?.ownersMax}</span>
          {' '}·{' '}
          Creators: <span className={`tag ${editorsFull ? 'full' : 'ok'}`}>{counts?.editors}/{counts?.editorsMax}</span>
          {' '}·{' '}
          Viewers: <span className={`tag ${viewersFull ? 'full' : 'ok'}`}>{counts?.viewers}/{counts?.viewersMax}</span>
        </p>
      </div>
    </section>
  );
}
