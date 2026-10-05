export default async () => {
  return Response.json(
    {
      ok: true,
      service: 'alley-gaitor-scheduler',
      stage: '4-security-skeleton',
      databaseConfigured: Boolean(process.env.DATABASE_URL),
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
