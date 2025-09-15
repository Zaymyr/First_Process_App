export default function Page() {
  return (
    <section style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
      <h1>Welcome 👋</h1>
      <p>Use the links below to navigate.</p>
      <ul style={{ lineHeight: 1.8 }}>
        <li><a href="/processes">Manage Processes</a></li>
        <li><a href="/org">Organization Settings</a></li>
        <li><a href="/org/members">Organization Members</a></li>
        <li><a href="/org/invite">Invite Users</a></li>
      </ul>
      <p style={{opacity:.7}}>Protected: you must be signed in to access content.</p>
    </section>
  );
}
