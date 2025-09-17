export async function sendInviteEmail(options: {
  to: string;
  subject?: string;
  html: string;
  text?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'RESEND_API_KEY not set' } as const;
  }
  const from = process.env.INVITE_EMAIL_FROM || 'no-reply@first-process.app';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject || 'You are invited to join an organization',
      html: options.html,
      text: options.text,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, reason: `HTTP ${res.status}: ${txt}` } as const;
  }
  return { ok: true } as const;
}
