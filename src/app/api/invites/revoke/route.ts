export async function POST() { return new Response(JSON.stringify({ error: 'Invite revoke removed' }), { status: 410 }); }
