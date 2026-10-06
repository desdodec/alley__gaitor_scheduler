import { pingDb } from '../lib/db.mjs';

export default async () => {
  const database = await pingDb();

  return Response.json(
    {
      ok: true,
      service: 'alley-gaitor-scheduler',
      stage: '5-persistent-bookings',
      databaseConfigured: database.configured,
      databaseReachable: database.reachable,
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
};

export const config = {
  path: '/api/health',
};
