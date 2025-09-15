'use client';
import { useEffect, useState } from 'react';

export default function InvitePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer'|'editor'>('viewer');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [seats, setSeats] = useState<null | { editors: { used:number, limit:number|null }, viewers: { used:number, limit:number|null } }>(null);
  const [err, setErr] = useState<string|null>(null);

  async function loadSeats() {
    try {
      const res = await fetch('/api/org/seats');
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to load seats');
      setSeats({ editors: j.editors, viewers: j.viewers });
    } catch (e:any) {
      setErr(e.message || 'Error');
    }
  }

  useEffect(() => { loadSeats(); }, []);

  const editorFull = seats?.editors.limit != null && seats.editors.used >= seats.editors.limit;
  const viewerFull = seats?.viewers.limit != null && seats.viewers.used >= seats.viewers.limit;
  const noSeatsAvailable = !!seats && editorFull && viewerFull;

  useEffect(() => {
    if (!seats) return;
    if (role === 'editor' && editorFull && !viewerFull) setRole('viewer');
    if (role === 'viewer' && viewerFull && !editorFull) setRole('editor');
  }, [seats, role, editorFull, viewerFull]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to invite');
      setMsg('Invite sent ✅');
      setEmail('');
      setRole('viewer');
      await loadSeats();
    } catch (err:any) {
      setMsg(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{display:'grid', gap:12, maxWidth:480}}>
      <h2>Invite user</h2>
      {err && <p style={{color:'crimson'}}>{err}</p>}
      <form onSubmit={onSubmit} style={{display:'grid', gap:8}}>
        <input type="email" placeholder="user@example.com" value={email}
               onChange={e=>setEmail(e.target.value)} required />
        <select value={role} onChange={e=>setRole(e.target.value as any)}>
          <option value="viewer" disabled={viewerFull}>
            Viewer{seats ? ` ${seats.viewers.used}/${seats.viewers.limit ?? '∞'}` : ''}
          </option>
          <option value="editor" disabled={editorFull}>
            Editor{seats ? ` ${seats.editors.used}/${seats.editors.limit ?? '∞'}` : ''}
          </option>
        </select>
        {noSeatsAvailable && (
          <p style={{ color: 'crimson' }}>Aucun siège disponible. Mettez à niveau votre plan pour inviter.</p>
        )}
        <button type="submit" disabled={pending || noSeatsAvailable}>
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </form>
      {msg && <p style={{color:'#0a0'}}>{msg}</p>}
    </section>
  );
}
