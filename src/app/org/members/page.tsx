'use client';
import { useEffect, useState } from 'react';
import { RemoveMemberButton } from './RemoveMemberButton';

type Member = { user_id: string; role: 'owner'|'editor'|'viewer'; can_edit: boolean };
type Row = Member & { email?: string|null; name?: string|null };

export default function MembersPage() {
  const [rows, setRows] = useState<Row[]|null>(null);
  const [err, setErr] = useState<string|null>(null);

  useEffect(() => { (async () => {
    const res = await fetch('/api/org/members'); // create route below
    const j = await res.json();
    if (!res.ok) setErr(j.error||'Failed'); else setRows(j.items);
  })(); }, []);

  async function changeRole(user_id: string, role: string) {
    const res = await fetch('/api/org/members', {
      method:'PATCH', headers:{'content-type':'application/json'},
      body: JSON.stringify({ user_id, role })
    });
    const j = await res.json();
    if (!res.ok) alert(j.error || 'Failed'); else location.reload();
  }
  function onRefresh() { location.reload(); }

  if (err) return <p style={{color:'crimson'}}>{err}</p>;
  if (!rows) return <p>Loading…</p>;
  return (
      <section className="stack">
        <h2>Members</h2>
        <ul className="stack">
          {rows.map(m=> (
            <li key={m.user_id} className="card" style={{display:'flex', gap:12, alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <div><strong>{m.name || m.email || m.user_id}</strong></div>
                <div className="muted" style={{fontSize:13}}>{m.email}</div>
              </div>
              <div className="row">
                <span className="tag">{m.role === 'editor' ? 'creator' : m.role}</span>
                <button className="btn btn-outline" onClick={()=>changeRole(m.user_id,'owner')}>Make owner</button>
                <button className="btn btn-outline" onClick={()=>changeRole(m.user_id,'editor')}>Make creator</button>
                <button className="btn btn-outline" onClick={()=>changeRole(m.user_id,'viewer')}>Make viewer</button>
                <RemoveMemberButton userId={m.user_id} self={false} onDone={onRefresh} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
}
