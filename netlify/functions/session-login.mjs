import { getDb, json } from './_db.mjs';
import { createSessionCookie, hashAccessCode } from './_session-auth.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) return json({ error: 'validation_failed' }, 400);

  try {
    const sql = getDb();
    const hash = hashAccessCode(code);
    const [helper] = await sql`
      select id, display_name
      from session_helpers
      where access_code_hash = ${hash}
        and is_active = true
      limit 1
    `;

    if (!helper) return json({ error: 'unauthorized' }, 401);

    await sql`
      update session_helpers
      set last_used_at = now()
      where id = ${helper.id}
    `;

    return json(
      { ok: true, helper: { id: helper.id, displayName: helper.display_name } },
      200,
      { 'set-cookie': createSessionCookie(helper.id) },
    );
  } catch (error) {
    console.error('session-login failed', error);
    return json({ error: 'session_login_failed' }, 500);
  }
};

export const config = {
  path: '/api/session/login',
};
