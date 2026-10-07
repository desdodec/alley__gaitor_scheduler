import { getDb, json } from './_db.mjs';
import { bearerToken, verifyBookingManageToken } from './_booking-manage-auth.mjs';
import { sendBookingActionConfirmation } from './_email.mjs';

const TIME_ZONE = 'Europe/London';
const OPEN_MINUTES = 10 * 60;
const CLOSE_MINUTES = 18 * 60;
const STEP_MINUTES = 5;
const MAX_DAYS_AHEAD = 60;

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function validRescheduleStart(startsAt, durationMinutes) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return false;
  const now = Date.now();
  if (start.getTime() <= now + 5 * 60 * 1000) return false;
  if (start.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return false;

  const local = zonedParts(start);
  const minuteOfDay = local.hour * 60 + local.minute;
  if (local.minute % STEP_MINUTES !== 0) return false;
  if (minuteOfDay < OPEN_MINUTES) return false;
  if (minuteOfDay + Number(durationMinutes) > CLOSE_MINUTES) return false;
  return true;
}

function publicBooking(booking, participants) {
  return {
    reference: booking.public_reference,
    startsAt: booking.starts_at,
    durationMinutes: Number(booking.duration_minutes),
    status: booking.status,
    participantCount: participants.length,
    participants: participants.map((participant) => ({ artworkName: participant.artwork_name })),
  };
}

async function loadBooking(sql, auth) {
  const [booking] = await sql`
    select id, public_reference, starts_at, duration_minutes, status, lead_name, lead_email
    from bookings
    where id = ${auth.bookingId}
      and public_reference = ${auth.reference}
    limit 1
  `;
  if (!booking) return null;
  const participants = await sql`
    select artwork_name
    from participants
    where booking_id = ${booking.id}
    order by position asc
  `;
  return { booking, participants };
}

async function sendActionEmailSafely(details) {
  try {
    return await sendBookingActionConfirmation(details);
  } catch (error) {
    console.error('booking action confirmation email failed', {
      bookingReference: details.reference,
      action: details.action,
      status: error?.status,
      details: error?.details,
    });
    return { sent: false, reason: 'send_failed' };
  }
}

export default async (request) => {
  if (!['GET', 'PATCH'].includes(request.method)) {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, PATCH' });
  }

  const auth = verifyBookingManageToken(bearerToken(request));
  if (!auth.ok) {
    return json({ error: auth.error }, auth.error === 'booking_manage_not_configured' ? 503 : 401);
  }

  try {
    const sql = getDb();
    const loaded = await loadBooking(sql, auth);
    if (!loaded) return json({ error: 'booking_not_found' }, 404);

    if (request.method === 'GET') {
      return json({ booking: publicBooking(loaded.booking, loaded.participants) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    if (body.action === 'cancel') {
      if (loaded.booking.status === 'cancelled') {
        return json({ booking: publicBooking(loaded.booking, loaded.participants), email: { sent: false, reason: 'already_cancelled' } });
      }
      if (loaded.booking.status !== 'booked') {
        return json({ error: 'booking_cannot_be_cancelled' }, 409);
      }

      const [updated] = await sql`
        update bookings
        set status = 'cancelled', updated_at = now()
        where id = ${loaded.booking.id}
          and status = 'booked'
        returning id, public_reference, starts_at, duration_minutes, status, lead_name, lead_email
      `;
      if (!updated) return json({ error: 'booking_state_changed' }, 409);

      const email = await sendActionEmailSafely({
        action: 'cancelled',
        to: updated.lead_email,
        leadName: updated.lead_name,
        reference: updated.public_reference,
        startsAt: updated.starts_at,
        durationMinutes: updated.duration_minutes,
        participants: loaded.participants.map((participant) => ({ artworkName: participant.artwork_name })),
      });

      return json({ booking: publicBooking(updated, loaded.participants), email });
    }

    if (body.action === 'reschedule') {
      if (loaded.booking.status !== 'booked') {
        return json({ error: 'booking_cannot_be_rescheduled' }, 409);
      }

      const requestedStart = new Date(body.startsAt);
      if (!validRescheduleStart(requestedStart, loaded.booking.duration_minutes)) {
        return json({ error: 'invalid_start_time' }, 400);
      }
      if (new Date(loaded.booking.starts_at).getTime() === requestedStart.getTime()) {
        return json({ booking: publicBooking(loaded.booking, loaded.participants), email: { sent: false, reason: 'unchanged' } });
      }

      const requestedEnd = new Date(requestedStart.getTime() + Number(loaded.booking.duration_minutes) * 60000);
      const overlap = await sql`
        select 1
        from bookings
        where id <> ${loaded.booking.id}
          and status not in ('cancelled', 'no_show')
          and starts_at < ${requestedEnd}
          and starts_at + (duration_minutes * interval '1 minute') > ${requestedStart}
        limit 1
      `;
      if (overlap.length) return json({ error: 'slot_unavailable' }, 409);

      const previousStartsAt = loaded.booking.starts_at;
      const [updated] = await sql`
        update bookings
        set starts_at = ${requestedStart}, updated_at = now()
        where id = ${loaded.booking.id}
          and status = 'booked'
        returning id, public_reference, starts_at, duration_minutes, status, lead_name, lead_email
      `;
      if (!updated) return json({ error: 'booking_state_changed' }, 409);

      const email = await sendActionEmailSafely({
        action: 'rescheduled',
        to: updated.lead_email,
        leadName: updated.lead_name,
        reference: updated.public_reference,
        startsAt: updated.starts_at,
        previousStartsAt,
        durationMinutes: updated.duration_minutes,
        participants: loaded.participants.map((participant) => ({ artworkName: participant.artwork_name })),
      });

      return json({ booking: publicBooking(updated, loaded.participants), email });
    }

    return json({ error: 'invalid_action' }, 400);
  } catch (error) {
    console.error('manage booking failed', error);
    return json({ error: 'booking_management_failed' }, 500);
  }
};

export const config = {
  path: '/api/manage-booking',
};
