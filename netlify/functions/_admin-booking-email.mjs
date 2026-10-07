function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatLondonDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function safeBookingTag(reference) {
  return String(reference).replace(/[^A-Za-z0-9_-]/g, '_');
}

export async function sendAdminBookingNotification({
  reference,
  startsAt,
  durationMinutes,
  leadName,
  leadEmail,
  leadPhone,
  relationship,
  artworkMode,
  participants,
}) {
  const to = String(process.env.BOOKING_ADMIN_EMAIL || '').trim();
  if (!to) return { sent: false, reason: 'admin_email_not_configured' };
  if (!process.env.RESEND_API_KEY || !process.env.BOOKING_EMAIL_FROM) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const when = formatLondonDateTime(startsAt);
  const names = participants.map((participant) => participant.artworkName || 'Participant').join(', ');
  const phone = leadPhone || 'Not provided';
  const mode = artworkMode === 'group' ? 'Group artwork' : 'Individual artworks';
  const subject = `New Alley Gaitor booking — ${when} — ${leadName}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:620px;margin:0 auto;padding:24px">
      <p style="text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#666;margin:0 0 12px">Alley Gaitor admin</p>
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 20px">New booking received</h1>
      <div style="border:1px solid #ddd;border-radius:12px;padding:18px;margin:20px 0">
        <p><strong>Booking reference:</strong> ${escapeHtml(reference)}</p>
        <p><strong>Date and time:</strong> ${escapeHtml(when)}</p>
        <p><strong>Session length:</strong> ${Number(durationMinutes)} minutes</p>
        <p><strong>Lead:</strong> ${escapeHtml(leadName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(leadEmail)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Relationship:</strong> ${escapeHtml(relationship)}</p>
        <p><strong>Artwork mode:</strong> ${escapeHtml(mode)}</p>
        <p><strong>Participants:</strong> ${escapeHtml(names)}</p>
      </div>
      <p>Open Run Sessions for the operational booking list.</p>
    </div>
  `;

  const text = [
    'Alley Gaitor — new booking received',
    '',
    `Booking reference: ${reference}`,
    `Date and time: ${when}`,
    `Session length: ${durationMinutes} minutes`,
    `Lead: ${leadName}`,
    `Email: ${leadEmail}`,
    `Phone: ${phone}`,
    `Relationship: ${relationship}`,
    `Artwork mode: ${mode}`,
    `Participants: ${names}`,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `booking-admin-notification/${reference}`,
    },
    body: JSON.stringify({
      from: process.env.BOOKING_EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      tags: [
        { name: 'category', value: 'booking_admin_notification' },
        { name: 'booking', value: safeBookingTag(reference) },
      ],
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error('admin_booking_email_failed');
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return { sent: true, id: payload?.id || null };
}
