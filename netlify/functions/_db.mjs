import postgres from 'postgres';

let client;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
    });
  }

  return client;
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function requireOperator(request) {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) {
    return { ok: false, response: json({ error: 'operator_not_configured' }, 503) };
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token || token !== expected) {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }

  return { ok: true };
}
