import postgres from 'postgres';

let client;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
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
  const sql = getDb();
  if (!sql) return { configured: false, reachable: false };

  try {
    const result = await sql`select 1 as ok`;
    return {
      configured: true,
      reachable: result?.[0]?.ok === 1,
    };
  } catch (error) {
    console.error('Database health check failed', error);
    return {
      configured: true,
      reachable: false,
    };
  }
}
