import { json } from './_db.mjs';
import { clearSessionCookie } from './_session-auth.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  }

  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
};

export const config = {
  path: '/api/session/logout',
};
