'use client';
import { useEffect, useState } from 'react';

type Invite = {
  id: string;
  email: string;
  role: 'viewer'|'editor';
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

export default function InvitePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer'|'editor'>('viewer');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [seats, setSeats] = useState<null | { editors: { used:number, limit:number|null }, viewers: { used:number, limit:number|null } }>(null);
  const [err, setErr] = useState<string|null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
  useEffect(() => { loadInvites(); }, []);

  async function loadInvites() {
    try {
      const res = await fetch('/api/invites');
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to load invites');
      setInvites(j.invites as Invite[]);
    } catch (e:any) {
      setErr(e.message || 'Error');
    }
  }

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
  await loadInvites();
    } catch (err:any) {
      setMsg(err.message || 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="stack" style={{maxWidth:720}}>
      <h2>Invite user</h2>
      {err && <p style={{color:'crimson'}}>{err}</p>}
      <form onSubmit={onSubmit} className="stack">
        <input className="input" type="email" placeholder="user@example.com" value={email}
               onChange={e=>setEmail(e.target.value)} required />
        <select className="select" value={role} onChange={e=>setRole(e.target.value as any)}>
          <option value="viewer" disabled={viewerFull}>
            Viewer{seats ? ` ${seats.viewers.used}/${seats.viewers.limit ?? '∞'}` : ''}
          </option>
          <option value="editor" disabled={editorFull}>
            Creator{seats ? ` ${seats.editors.used}/${seats.editors.limit ?? '∞'}` : ''}
          </option>
        </select>
        {noSeatsAvailable && (
          <p style={{ color: 'crimson' }}>Aucun siège disponible. Mettez à niveau votre plan pour inviter.</p>
        )}
        <button className="btn" type="submit" disabled={pending || noSeatsAvailable}>
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </form>
      {msg && <p className="muted">{msg}</p>}

      <div className="card stack" style={{marginTop:16}}>
        <div className="spaced">
          <h3>Pending & history</h3>
          <button className="btn btn-outline" onClick={loadInvites}>Refresh</button>
        </div>
        {!invites && <p className="muted">Loading…</p>}
        {invites && invites.length === 0 && <p className="muted">No invites yet.</p>}
        {invites && invites.length > 0 && (
          <ul className="stack" style={{gap:8}}>
            {invites.map((i) => {
              const accepted = !!i.accepted_at;
              return (
                <li key={i.id} className="row" style={{justifyContent:'space-between'}}>
                  <div className="row" style={{gap:8}}>
                    <span className={`tag ${accepted ? 'ok' : ''}`}>{accepted ? 'Accepted' : 'Pending'}</span>
                    <span>{i.email}</span>
                    <span className="muted">{i.role === 'editor' ? 'Creator' : 'Viewer'}</span>
                    <span className="muted">{new Date(i.created_at).toLocaleString()}</span>
                  </div>
                  <div className="row" style={{gap:8}}>
                    {!accepted && (
                      <button
                        className="btn btn-outline"
                        disabled={busyId === i.id}
                        onClick={async () => {
                          setBusyId(i.id);
                          try {
                            const res = await fetch('/api/invites/resend', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ inviteId: i.id }) });
                            const j = await res.json();
                            if (!res.ok) throw new Error(j?.error || 'Failed to resend');
                            setMsg('Invite resent ✅');
                          } catch (e:any) {
                            setMsg(e.message || 'Error');
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >Resend</button>
                    )}
                    {!accepted && (
                      <button
                        className="btn btn-danger"
                        disabled={busyId === i.id}
                        onClick={async () => {
                          if (!confirm('Revoke this invite?')) return;
                          setBusyId(i.id);
                          try {
                            const res = await fetch('/api/invites/revoke', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ inviteId: i.id }) });
                            const j = await res.json();
                            if (!res.ok) throw new Error(j?.error || 'Failed to revoke');
                            setMsg('Invite revoked ✅');
                            await loadInvites();
                          } catch (e:any) {
                            setMsg(e.message || 'Error');
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >Revoke</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
