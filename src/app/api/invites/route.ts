// Invitations feature entièrement supprimée. Stub conservé temporairement.
export async function GET() {
  return new Response(JSON.stringify({ invites: [], deprecated: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
export async function POST() {
  return new Response(JSON.stringify({ error: 'Invitations feature removed' }), { status: 410, headers: { 'content-type': 'application/json' } });
}
