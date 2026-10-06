import postgres from 'postgres';

let client;

function getConnectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;

  const value = raw.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('DATABASE_URL must start with postgres:// or postgresql://');
    }
  } catch (error) {
    const wrapped = new Error('DATABASE_URL is not a valid PostgreSQL URL');
    wrapped.cause = error;
    throw wrapped;
  }

  return value;
}

export function getDb() {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  if (!client) {
    client = postgres(connectionString, {
      ssl: 'require',
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return client;
}

export async function pingDb() {
  try {
    const sql = getDb();
    if (!sql) {
      return {
        configured: false,
        reachable: false,
        error: null,
      };
    }

    const result = await sql`select 1 as ok`;
    return {
      configured: true,
      reachable: result?.[0]?.ok === 1,
      error: null,
    };
  } catch (error) {
    console.error('Database health check failed', error);
    return {
      configured: Boolean(process.env.DATABASE_URL),
      reachable: false,
      error: error?.message || 'database_connection_failed',
    };
  }
}
