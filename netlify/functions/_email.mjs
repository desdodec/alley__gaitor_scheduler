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

function participantNames(participants = []) {
  return participants.map((participant) => participant.artworkName || 'Participant').join(', ');
}

function safeBookingTag(reference) {
  return String(reference).replace(/[^A-Za-z0-9_-]/g, '_');
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.BOOKING_EMAIL_FROM);
}

async function sendEmail({ to, subject, html, text, idempotencyKey, category, reference }) {
  if (!emailConfigured()) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const replyTo = process.env.BOOKING_REPLY_TO || process.env.BOOKING_ADMIN_EMAIL || undefined;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.BOOKING_EMAIL_FROM,
      to: [to],
      reply_to: replyTo,
      subject,
      html,
      text,
      tags: [
        { name: 'category', value: category },
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
    const error = new Error('booking_email_failed');
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return { sent: true, id: payload?.id || null };
}

export async function sendBookingConfirmation({
  to,
  leadName,
  reference,
  startsAt,
  durationMinutes,
  participants,
  manageUrl,
}) {
  const names = participantNames(participants);
  const when = formatLondonDateTime(startsAt);
  const subject = `Alley Gaitor booking confirmed — ${reference}`;
  const manageButton = manageUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700">Manage booking</a></p>`
    : '';

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
        <p style="margin:0"><strong>Participant${participants.length === 1 ? '' : 's'}:</strong> ${escapeHtml(names)}</p>
      </div>
      ${manageButton}
      <p>${manageUrl ? 'Use the secure link above to reschedule or cancel without creating an account. ' : ''}Please keep your booking reference as a fallback.</p>
      <p>You can reply to this email if you need help.</p>
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
    `Participants: ${names}`,
    '',
    manageUrl ? `Manage booking: ${manageUrl}` : '',
    'Please keep your booking reference as a fallback.',
    'You can reply to this email if you need help.',
  ].filter(Boolean).join('\n');

  return sendEmail({
    to,
    subject,
    html,
    text,
    idempotencyKey: `booking-confirmation/${reference}`,
    category: 'booking_confirmation',
    reference,
  });
}

export async function sendBookingActionConfirmation({
  action,
  to,
  leadName,
  reference,
  startsAt,
  previousStartsAt,
  durationMinutes,
  participants,
}) {
  const names = participantNames(participants);
  const when = formatLondonDateTime(startsAt);
  const isCancelled = action === 'cancelled';
  const previousWhen = previousStartsAt ? formatLondonDateTime(previousStartsAt) : null;
  const heading = isCancelled ? 'Your booking has been cancelled' : 'Your booking has been rescheduled';
  const subject = isCancelled
    ? `Alley Gaitor booking cancelled — ${reference}`
    : `Alley Gaitor booking rescheduled — ${reference}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:620px;margin:0 auto;padding:24px">
      <p style="text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#666;margin:0 0 12px">Alley Gaitor</p>
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 20px">${heading}</h1>
      <p>Hi ${escapeHtml(leadName)},</p>
      <div style="border:1px solid #ddd;border-radius:12px;padding:18px;margin:20px 0">
        <p style="margin:0 0 8px"><strong>Booking reference:</strong> ${escapeHtml(reference)}</p>
        ${previousWhen ? `<p style="margin:0 0 8px"><strong>Previous date and time:</strong> ${escapeHtml(previousWhen)}</p>` : ''}
        <p style="margin:0 0 8px"><strong>${isCancelled ? 'Cancelled session' : 'New date and time'}:</strong> ${escapeHtml(when)}</p>
        <p style="margin:0 0 8px"><strong>Session length:</strong> ${Number(durationMinutes)} minutes</p>
        <p style="margin:0"><strong>Participant${participants.length === 1 ? '' : 's'}:</strong> ${escapeHtml(names)}</p>
      </div>
      <p>Please keep your booking reference as a fallback.</p>
      <p>You can reply to this email if you need help.</p>
      <p style="color:#666;font-size:13px;margin-top:28px">This email confirms a change made through the secure Alley Gaitor booking-management link.</p>
    </div>
  `;

  const text = [
    `Alley Gaitor — booking ${action}`,
    '',
    `Hi ${leadName},`,
    '',
    `Booking reference: ${reference}`,
    previousWhen ? `Previous date and time: ${previousWhen}` : '',
    `${isCancelled ? 'Cancelled session' : 'New date and time'}: ${when}`,
    `Session length: ${durationMinutes} minutes`,
    `Participants: ${names}`,
    '',
    'Please keep your booking reference as a fallback.',
    'You can reply to this email if you need help.',
  ].filter(Boolean).join('\n');

  const actionKey = isCancelled
    ? `booking-cancelled/${reference}`
    : `booking-rescheduled/${reference}/${new Date(startsAt).toISOString()}`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    idempotencyKey: actionKey,
    category: isCancelled ? 'booking_cancelled' : 'booking_rescheduled',
    reference,
  });
}
