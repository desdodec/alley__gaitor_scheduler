import { pingDb } from '../lib/db.mjs';
import { bookingManageConfigured } from './_booking-manage-auth.mjs';

export default async () => {
  const database = await pingDb();

  return Response.json(
    {
      ok: true,
      service: 'alley-gaitor-scheduler',
      stage: '6-participant-booking-management',
      databaseConfigured: database.configured,
      databaseReachable: database.reachable,
      resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
      bookingEmailFromConfigured: Boolean(process.env.BOOKING_EMAIL_FROM),
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.BOOKING_EMAIL_FROM),
      bookingManageConfigured: bookingManageConfigured(),
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
