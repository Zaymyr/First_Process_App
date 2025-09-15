export default function Page() {
  return (
    <section className="stack" style={{ maxWidth: 860 }}>
      <div className="card card-hover" style={{ padding: 24 }}>
        <h1 className="title-gradient">First Process App</h1>
        <p className="muted" style={{ marginTop: 6 }}>Organisez, partagez et exécutez vos processus d’équipe simplement.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <a className="btn btn-lg" href="/processes">Gérer les Process</a>
          <a className="btn btn-outline btn-lg" href="/org">Paramètres d’Organisation</a>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3>Raccourcis</h3>
        <ul style={{ lineHeight: 1.9, marginTop: 8 }}>
          <li><a className="link" href="/org/members">Membres de l’organisation</a></li>
          <li><a className="link" href="/org/invite">Inviter des utilisateurs</a></li>
        </ul>
      </div>
      <p className="muted">Zone protégée — connexion requise.</p>
    </section>
  );
}
