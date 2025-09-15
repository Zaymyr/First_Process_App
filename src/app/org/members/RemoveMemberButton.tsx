"use client";
import { useState } from 'react';

export function RemoveMemberButton({ userId, self, onDone }: { userId: string; self: boolean; onDone: ()=>void }) {
  const [open, setOpen] = useState(false);
  const [hard, setHard] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  if (self) return null;

  async function submit() {
    setPending(true); setErr(null);
    try {
      const res = await fetch('/api/org/members', { method:'DELETE', headers:{'content-type':'application/json'}, body: JSON.stringify({ user_id: userId, hard }) });
      const j = await res.json();
      if (!res.ok) { setErr(j.error||'Failed'); return; }
      onDone();
    } finally { setPending(false); }
  }

  return (
    <>
      <button className="btn btn-danger" onClick={()=>setOpen(true)}>Remove</button>
      {open && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
          <div className="card stack" style={{maxWidth:480}}>
            <h3>Remove member</h3>
            <p style={{fontSize:14,lineHeight:1.4}}>Cette action va retirer ce membre de l'organisation. Optionnel: suppression complète de son compte d'authentification (il devra recréer un compte et être réinvité). Les invitations en attente associées à son email seront supprimées.</p>
            <label style={{display:'flex', gap:8, fontSize:14, alignItems:'center'}}>
              <input type="checkbox" checked={hard} onChange={e=>setHard(e.target.checked)} />
              <span>Supprimer aussi le compte utilisateur (irréversible)</span>
            </label>
            {err && <p style={{color:'crimson', fontSize:13}}>{err}</p>}
            <div className="row" style={{justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline" onClick={()=>!pending && setOpen(false)}>Annuler</button>
              <button className="btn btn-danger" disabled={pending} onClick={submit}>{pending? 'Removing…':'Confirmer la suppression'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
