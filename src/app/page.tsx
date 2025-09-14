export default function Page() {
  return (
    <section style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
      <h1>Welcome 👋</h1>
      <p>Use the links below to navigate.</p>
      <ul style={{ lineHeight: 1.8 }}>
        <li><a href="/processes">Manage Processes</a></li>
      </ul>
      <p style={{opacity:.7}}>Tip: if you’re not signed in, the header shows a Login link.</p>
    </section>
  );
}
