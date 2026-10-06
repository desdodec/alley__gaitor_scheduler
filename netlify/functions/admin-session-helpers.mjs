import crypto from 'node:crypto';
import { getDb, json, requireOperator } from './_db.mjs';
import { hashAccessCode } from './_session-auth.mjs';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return code;
}

function cleanName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

export default async (request) => {
  const auth = requireOperator(request);
  if (!auth.ok) return auth.response;

  try {
    const sql = getDb();

    if (request.method === 'GET') {
      const helpers = await sql`
        select id, display_name, is_active, created_at, last_used_at
        from session_helpers
        order by display_name asc
      `;
      return json({ helpers });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }

      const displayName = cleanName(body.displayName);
      if (!displayName) return json({ error: 'validation_failed' }, 400);

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = generateCode();
        const hash = hashAccessCode(code);
        try {
          const [helper] = await sql`
            insert into session_helpers (display_name, access_code_hash)
            values (${displayName}, ${hash})
            returning id, display_name, is_active, created_at
          `;
          return json({
            helper,
            accessCode: code,
            message: 'Store this code now; it is not recoverable later.',
          }, 201);
        } catch (error) {
          if (error?.code !== '23505') throw error;
        }
      }

      return json({ error: 'could_not_allocate_access_code' }, 500);
    }

    if (request.method === 'PATCH') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }

      const id = typeof body.id === 'string' ? body.id : '';
      if (!id || typeof body.isActive !== 'boolean') {
        return json({ error: 'validation_failed' }, 400);
      }

      const [helper] = await sql`
        update session_helpers
        set is_active = ${body.isActive}
        where id = ${id}
        returning id, display_name, is_active, created_at, last_used_at
      `;

      if (!helper) return json({ error: 'helper_not_found' }, 404);
      return json({ helper });
    }

    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST, PATCH' });
  } catch (error) {
    console.error('admin-session-helpers failed', error);
    return json({ error: 'database_unavailable' }, 503);
  }
};

export const config = {
  path: '/api/admin/session-helpers',
};
