import { getOrgContext } from '@/lib/org';
import OrgNameForm from '@/app/org/OrgNameForm';

export const dynamic = 'force-dynamic';

export default async function OrgSettingsPage() {
  const { user, org } = await getOrgContext();
  if (!user) return null;
  if (!org) return <p>No organization found for your account.</p>;

  return (
    <section className="stack" style={{maxWidth:640}}>
      <h2>Organization Settings</h2>
      <OrgNameForm initial={org.name ?? ''} />
    </section>
  );
}
