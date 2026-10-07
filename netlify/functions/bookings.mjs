import crypto from 'node:crypto';
import { getDb, json } from './_db.mjs';
import { sendBookingConfirmation } from './_email.mjs';

const RELATIONSHIPS = new Set(['individual', 'family', 'friends', 'colleagues', 'other']);
const ARTWORK_MODES = new Set(['individual', 'group']);

function durationForCount(count) {
  if (count === 1) return 5;
  if (count <= 3) return 10;
  return 15;
}

function cleanString(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function validateBody(body) {
  const errors = [];
  const participants = Array.isArray(body.participants) ? body.participants : [];

  if (!cleanString(body.leadName)) errors.push('leadName');
  if (!cleanString(body.leadEmail) || !String(body.leadEmail).includes('@')) errors.push('leadEmail');
  if (!cleanString(body.addressLine1)) errors.push('addressLine1');
  if (!cleanString(body.townCity)) errors.push('townCity');
  if (!cleanString(body.postcode)) errors.push('postcode');
  if (!RELATIONSHIPS.has(body.relationship)) errors.push('relationship');
  if (!ARTWORK_MODES.has(body.artworkMode)) errors.push('artworkMode');
  if (!body.startsAt || Number.isNaN(Date.parse(body.startsAt))) errors.push('startsAt');
  if (participants.length < 1 || participants.length > 4) errors.push('participants');

  participants.forEach((participant, index) => {
    if (!cleanString(participant.artworkName, 80)) errors.push(`participants[${index}].artworkName`);
  });

  return { errors, participants };
}

function randomDigits(length) {
  let value = '';
  while (value.length < length) {
    value += String(crypto.randomInt(0, 10));
  }
  return value;
}

function bookingReference() {
  const year = new Date().getUTCFullYear().toString().slice(-2);
  return `AG-${year}-${crypto.randomInt(0, 100000).toString().padStart(5, '0')}`;
}

async function uniqueRecordingCode(sql) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomDigits(5);
    const existing = await sql`select 1 from participants where recording_code = ${code} limit 1`;
    if (existing.length === 0) return code;
  }
  throw new Error('Could not allocate recording code');
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }

  if (!process.env.DATABASE_URL) {
    return json({ error: 'database_not_configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { errors, participants } = validateBody(body);
  if (errors.length) {
    return json({ error: 'validation_failed', fields: errors }, 400);
  }

  try {
    const sql = getDb();
    const startsAt = new Date(body.startsAt);
    const durationMinutes = durationForCount(participants.length);

    const overlap = await sql`
      select 1
      from bookings
      where status not in ('cancelled', 'no_show')
        and starts_at < ${new Date(startsAt.getTime() + durationMinutes * 60000)}
        and starts_at + (duration_minutes * interval '1 minute') > ${startsAt}
      limit 1
    `;

    if (overlap.length) {
      return json({ error: 'slot_unavailable' }, 409);
    }

    let reference;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      reference = bookingReference();
      const existing = await sql`select 1 from bookings where public_reference = ${reference} limit 1`;
      if (existing.length === 0) break;
    }

    const recordingCodes = [];
    for (let i = 0; i < participants.length; i += 1) {
      recordingCodes.push(await uniqueRecordingCode(sql));
    }

    const result = await sql.begin(async (tx) => {
      const [booking] = await tx`
        insert into bookings (
          public_reference,
          starts_at,
          duration_minutes,
          relationship,
          artwork_mode,
          lead_name,
          lead_email,
          lead_phone,
          address_line_1,
          address_line_2,
          town_city,
          county,
          postcode,
          country_code,
          personal_data_delete_after
        ) values (
          ${reference},
          ${startsAt},
          ${durationMinutes},
          ${body.relationship},
          ${body.artworkMode},
          ${cleanString(body.leadName, 120)},
          ${cleanString(body.leadEmail, 200).toLowerCase()},
          ${cleanString(body.leadPhone, 50) || null},
          ${cleanString(body.addressLine1, 200)},
          ${cleanString(body.addressLine2, 200) || null},
          ${cleanString(body.townCity, 120)},
          ${cleanString(body.county, 120) || null},
          ${cleanString(body.postcode, 20).toUpperCase()},
          'GB',
          ${new Date(startsAt.getTime() + 180 * 24 * 60 * 60 * 1000)}
        )
        returning id, public_reference, starts_at, duration_minutes
      `;

      for (let i = 0; i < participants.length; i += 1) {
        const participant = participants[i];
        await tx`
          insert into participants (
            booking_id,
            artwork_name,
            t_shirt_size,
            position,
            recording_code,
            visualisation_id
          ) values (
            ${booking.id},
            ${cleanString(participant.artworkName, 80)},
            ${cleanString(participant.tShirtSize, 20) || null},
            ${i + 1},
            ${recordingCodes[i]},
            ${cleanString(participant.visualisationId, 30) || null}
          )
        `;
      }

      return booking;
    });

    let email = { sent: false, reason: 'not_attempted' };
    try {
      email = await sendBookingConfirmation({
        to: cleanString(body.leadEmail, 200).toLowerCase(),
        leadName: cleanString(body.leadName, 120),
        reference: result.public_reference,
        startsAt: result.starts_at,
        durationMinutes: result.duration_minutes,
        participants: participants.map((participant) => ({
          artworkName: cleanString(participant.artworkName, 80),
        })),
      });
    } catch (error) {
      console.error('booking confirmation email failed', {
        bookingReference: result.public_reference,
        status: error?.status,
        details: error?.details,
      });
      email = { sent: false, reason: 'send_failed' };
    }

    return json({
      booking: {
        reference: result.public_reference,
        startsAt: result.starts_at,
        durationMinutes: result.duration_minutes,
        participantCount: participants.length,
      },
      email,
    }, 201);
  } catch (error) {
    console.error('booking creation failed', error);
    return json({ error: 'booking_creation_failed' }, 500);
  }
};

export const config = {
  path: '/api/bookings',
};
