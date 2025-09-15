import { getOrgContext } from '@/lib/org';

export const dynamic = 'force-dynamic';

export default async function OrgPlanPage() {
  const { user, org, sub, counts } = await getOrgContext();
  if (!user) return null;
  if (!org) return <p>No organization found for your account.</p>;

  const ownersFull = counts && counts.ownersMax !== undefined ? counts.owners >= (counts.ownersMax ?? 0) : false;
  const editorsFull = counts && counts.editorsMax !== undefined ? counts.editors >= (counts.editorsMax ?? 0) : false;
  const viewersFull = counts && counts.viewersMax !== undefined ? counts.viewers >= (counts.viewersMax ?? 0) : false;

  return (
    <section className="stack" style={{maxWidth:640}}>
      <h2>Plan</h2>
      <div className="card stack">
        <p className="muted">Plan: <strong>{sub?.plan_id ?? '—'}</strong> · status: <strong>{sub?.status ?? '—'}</strong></p>
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
