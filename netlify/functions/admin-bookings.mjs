import { getDb, json, requireOperator } from './_db.mjs';

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
  }

  const auth = requireOperator(request);
  if (!auth.ok) return auth.response;

  try {
    const sql = getDb();
    const rows = await sql`
      select
        b.id,
        b.public_reference,
        b.starts_at,
        b.duration_minutes,
        b.status,
        b.relationship,
        b.artwork_mode,
        b.lead_name,
        b.lead_email,
        b.lead_phone,
        b.address_line_1,
        b.address_line_2,
        b.town_city,
        b.county,
        b.postcode,
        b.country_code,
        b.created_at,
        json_agg(
          json_build_object(
            'id', p.id,
            'artworkName', p.artwork_name,
            'position', p.position,
            'recordingCode', p.recording_code,
            'recordingStatus', p.recording_status,
            'visualisationId', p.visualisation_id,
            'tShirtSize', p.t_shirt_size
          ) order by p.position
        ) as participants
      from bookings b
      join participants p on p.booking_id = b.id
      where b.starts_at >= now() - interval '30 days'
        and b.starts_at < now() + interval '180 days'
      group by b.id
      order by b.starts_at asc
    `;

    return json({ bookings: rows });
  } catch (error) {
    console.error('admin-bookings failed', error);
    return json({ error: 'database_unavailable' }, 503);
  }
};

export const config = {
  path: '/api/admin/bookings',
};
