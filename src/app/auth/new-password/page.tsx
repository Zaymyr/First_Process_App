export default function RemovedNewPasswordPage() {
  return (
    <div style={{padding:40,fontFamily:'sans-serif'}}>
      <h2>Page supprimée</h2>
      <p>Le flux de définition de mot de passe via cette URL a été retiré. Utilisez désormais le lien reçu par email qui redirige vers <code>/auth/accept</code>.</p>
    </div>
  );
}
