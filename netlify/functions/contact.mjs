import { json } from './_db.mjs';

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.BOOKING_EMAIL_FROM || !process.env.BOOKING_ADMIN_EMAIL) {
    return json({ error: 'contact_not_configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const message = clean(body.message, 3000);
  const website = clean(body.website, 200);

  // Quietly accept obvious bot submissions without sending mail.
  if (website) return json({ sent: true });

  if (!name || !email.includes('@') || !message) {
    return json({ error: 'validation_failed' }, 400);
  }

  const subject = `Alley Gaitor contact — ${name}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:620px;margin:0 auto;padding:24px">
      <p style="text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#666;margin:0 0 12px">Alley Gaitor</p>
      <h1 style="font-size:26px;line-height:1.15;margin:0 0 20px">New website contact</h1>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <div style="border:1px solid #ddd;border-radius:12px;padding:18px;margin:20px 0;white-space:pre-wrap">${escapeHtml(message)}</div>
      <p style="color:#666;font-size:13px">Reply to this email to answer ${escapeHtml(name)}.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.BOOKING_EMAIL_FROM,
      to: [process.env.BOOKING_ADMIN_EMAIL],
      reply_to: email,
      subject,
      html,
      text: `Alley Gaitor website contact\n\nName: ${name}\nEmail: ${email}\n\n${message}`,
      tags: [{ name: 'category', value: 'website_contact' }],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('contact email failed', { status: response.status, details });
    return json({ error: 'send_failed' }, 502);
  }

  return json({ sent: true });
};

export const config = {
  path: '/api/contact',
};
