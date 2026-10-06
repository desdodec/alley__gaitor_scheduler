import { getDb, json } from './_db.mjs';
import { verifySession } from './_session-auth.mjs';

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
  }

  const auth = verifySession(request);
  if (!auth.ok) return auth.response;

  try {
    const sql = getDb();

    const [helper] = await sql`
      select id, display_name, is_active
      from session_helpers
      where id = ${auth.helperId}
      limit 1
    `;

    if (!helper || !helper.is_active) {
      return json({ error: 'unauthorized' }, 401);
    }

    const rows = await sql`
      select
        b.id,
        b.public_reference,
        b.starts_at,
        b.duration_minutes,
        b.status,
        b.relationship,
        b.artwork_mode,
        json_agg(
          json_build_object(
            'id', p.id,
            'artworkName', p.artwork_name,
            'position', p.position,
            'recordingCode', p.recording_code,
            'recordingStatus', p.recording_status,
            'visualisationId', p.visualisation_id
          ) order by p.position
        ) as participants
      from bookings b
      join participants p on p.booking_id = b.id
      where b.starts_at >= now() - interval '12 hours'
        and b.starts_at < now() + interval '14 days'
        and b.status <> 'cancelled'
      group by b.id
      order by b.starts_at asc
    `;

    return json({
      helper: { id: helper.id, displayName: helper.display_name },
      bookings: rows,
    });
  } catch (error) {
    console.error('session-bookings failed', error);
    return json({ error: 'database_unavailable' }, 503);
  }
};

export const config = {
  path: '/api/session/bookings',
};
