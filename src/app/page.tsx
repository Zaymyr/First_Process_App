import { createClient } from '@/lib/supabase-server';

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const name = (user?.user_metadata as any)?.full_name || user?.email || 'there';

  return (
    <section style={{ paddingTop: 8 }}>
      <h1 className="title-plain">Welcome {name}</h1>
    </section>
  );
}
