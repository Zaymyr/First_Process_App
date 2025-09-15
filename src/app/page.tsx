export default function Page() {
  return (
    <section className="stack" style={{ maxWidth: 860 }}>
      <div className="card" style={{ padding: 22 }}>
        <h1 className="title-plain" style={{ fontSize: 36 }}>First Process App</h1>
        <p className="muted" style={{ marginTop: 8 }}>Organisez, partagez et exécutez vos processus d’équipe simplement.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn btn-lg" href="/processes">Gérer les Process</a>
          <a className="btn btn-outline btn-lg" href="/org">Paramètres d’Organisation</a>
        </div>
      </div>
      <ul className="card" style={{ padding: 16, lineHeight: 1.9 }}>
        <li><a className="link" href="/org/members">Membres de l’organisation</a></li>
        <li><a className="link" href="/org/invite">Inviter des utilisateurs</a></li>
      </ul>
      <p className="muted" style={{ marginTop: 4 }}>Zone protégée — connexion requise.</p>
    </section>
  );
}
