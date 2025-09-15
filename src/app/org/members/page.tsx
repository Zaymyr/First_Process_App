'use client';
import { useEffect, useState } from 'react';

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
  async function remove(user_id: string) {
    if (!confirm('Remove member?')) return;
    const res = await fetch('/api/org/members', {
      method:'DELETE', headers:{'content-type':'application/json'},
      body: JSON.stringify({ user_id })
    });
    const j = await res.json();
    if (!res.ok) alert(j.error || 'Failed'); else location.reload();
  }

  if (err) return <p style={{color:'crimson'}}>{err}</p>;
  if (!rows) return <p>Loading…</p>;
  return (
    <section>
      <h2>Members</h2>
      <ul>
        {rows.map(m=>(
          <li key={m.user_id} style={{margin:'6px 0'}}>
            {m.name ? `${m.name}${m.email ? ` (${m.email})` : ''}` : (m.email || m.user_id)} — <strong>{m.role}</strong>
            <button onClick={()=>changeRole(m.user_id,'viewer')} style={{marginLeft:8}}>Make viewer</button>
            <button onClick={()=>changeRole(m.user_id,'editor')} style={{marginLeft:8}}>Make editor</button>
            <button onClick={()=>remove(m.user_id)} style={{marginLeft:8, color:'crimson'}}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
