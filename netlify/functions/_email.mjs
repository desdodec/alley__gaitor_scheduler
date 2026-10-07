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

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.BOOKING_EMAIL_FROM);
}

export async function sendBookingConfirmation({
  to,
  leadName,
  reference,
  startsAt,
  durationMinutes,
  participants,
}) {
  if (!emailConfigured()) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const participantNames = (participants || [])
    .map((participant) => escapeHtml(participant.artworkName || 'Participant'))
    .join(', ');
  const when = formatLondonDateTime(startsAt);
  const subject = `Alley Gaitor booking confirmed — ${reference}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:620px;margin:0 auto;padding:24px">
      <p style="text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#666;margin:0 0 12px">Alley Gaitor</p>
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 20px">Your session is booked</h1>
      <p>Hi ${escapeHtml(leadName)},</p>
      <p>Your Alley Gaitor bicycle-walk session has been confirmed.</p>
      <div style="border:1px solid #ddd;border-radius:12px;padding:18px;margin:20px 0">
        <p style="margin:0 0 8px"><strong>Booking reference:</strong> ${escapeHtml(reference)}</p>
        <p style="margin:0 0 8px"><strong>Date and time:</strong> ${escapeHtml(when)}</p>
        <p style="margin:0 0 8px"><strong>Session length:</strong> ${Number(durationMinutes)} minutes</p>
        <p style="margin:0"><strong>Participant${participants.length === 1 ? '' : 's'}:</strong> ${participantNames}</p>
      </div>
      <p>Please keep your booking reference. If you need to change or cancel the booking, reply to the project contact once cancellation/rescheduling links are enabled.</p>
      <p style="color:#666;font-size:13px;margin-top:28px">This email was sent because this address was used to make an Alley Gaitor booking.</p>
    </div>
  `;

  const text = [
    'Alley Gaitor — booking confirmed',
    '',
    `Hi ${leadName},`,
    '',
    `Booking reference: ${reference}`,
    `Date and time: ${when}`,
    `Session length: ${durationMinutes} minutes`,
    `Participants: ${(participants || []).map((participant) => participant.artworkName || 'Participant').join(', ')}`,
    '',
    'Please keep your booking reference.',
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `booking-confirmation/${reference}`,
    },
    body: JSON.stringify({
      from: process.env.BOOKING_EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      tags: [
        { name: 'category', value: 'booking_confirmation' },
        { name: 'booking', value: String(reference).replace(/[^A-Za-z0-9_-]/g, '_') },
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
    const error = new Error('confirmation_email_failed');
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return { sent: true, id: payload?.id || null };
}
