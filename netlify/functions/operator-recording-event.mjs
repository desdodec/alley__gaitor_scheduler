import { getDb, json, requireOperator } from './_db.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }

  const auth = requireOperator(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const participantId = typeof body.participantId === 'string' ? body.participantId : '';
  const eventType = body.eventType;

  if (!participantId || !['start', 'end'].includes(eventType)) {
    return json({ error: 'validation_failed' }, 400);
  }

  try {
    const sql = getDb();
    const [participant] = await sql`
      select id, recording_status
      from participants
      where id = ${participantId}
      limit 1
    `;

    if (!participant) return json({ error: 'participant_not_found' }, 404);

    const nextStatus = eventType === 'start' ? 'started' : 'recorded';

    await sql.begin(async (tx) => {
      await tx`
        insert into recording_events (participant_id, event_type)
        values (${participantId}, ${eventType})
        on conflict (participant_id, event_type)
        do update set occurred_at = now()
      `;

      await tx`
        update participants
        set recording_status = ${nextStatus}
        where id = ${participantId}
      `;
    });

    return json({ ok: true, participantId, recordingStatus: nextStatus });
  } catch (error) {
    console.error('operator-recording-event failed', error);
    return json({ error: 'database_unavailable' }, 503);
  }
};

export const config = {
  path: '/api/operator/recording-event',
};
