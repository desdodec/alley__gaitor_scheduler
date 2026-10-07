import { afterEach, describe, expect, it } from 'vitest';
import {
  bookingManageConfigured,
  createBookingManageToken,
  verifyBookingManageToken,
} from '../netlify/functions/_booking-manage-auth.mjs';

const ORIGINAL_MANAGE_SECRET = process.env.BOOKING_MANAGE_SECRET;
const ORIGINAL_SESSION_SECRET = process.env.SESSION_COOKIE_SECRET;

afterEach(() => {
  if (ORIGINAL_MANAGE_SECRET === undefined) delete process.env.BOOKING_MANAGE_SECRET;
  else process.env.BOOKING_MANAGE_SECRET = ORIGINAL_MANAGE_SECRET;

  if (ORIGINAL_SESSION_SECRET === undefined) delete process.env.SESSION_COOKIE_SECRET;
  else process.env.SESSION_COOKIE_SECRET = ORIGINAL_SESSION_SECRET;
});

describe('booking management tokens', () => {
  it('creates and verifies a signed token', () => {
    process.env.BOOKING_MANAGE_SECRET = 'a'.repeat(48);

    const token = createBookingManageToken({
      bookingId: '11111111-1111-1111-1111-111111111111',
      reference: 'AG-26-12345',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = verifyBookingManageToken(token);
    expect(result.ok).toBe(true);
    expect(result.bookingId).toBe('11111111-1111-1111-1111-111111111111');
    expect(result.reference).toBe('AG-26-12345');
  });

  it('rejects tampered tokens', () => {
    process.env.BOOKING_MANAGE_SECRET = 'b'.repeat(48);
    const token = createBookingManageToken({ bookingId: 'booking-1', reference: 'AG-26-00001' });
    const [payload, signature] = token.split('.');
    const replacement = signature.endsWith('A') ? 'B' : 'A';
    const tampered = `${payload}.${signature.slice(0, -1)}${replacement}`;

    expect(verifyBookingManageToken(tampered)).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('rejects expired tokens', () => {
    process.env.BOOKING_MANAGE_SECRET = 'c'.repeat(48);
    const token = createBookingManageToken({
      bookingId: 'booking-2',
      reference: 'AG-26-00002',
      expiresAt: new Date(Date.now() - 60_000),
    });

    expect(verifyBookingManageToken(token)).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('falls back to the existing session cookie secret', () => {
    delete process.env.BOOKING_MANAGE_SECRET;
    process.env.SESSION_COOKIE_SECRET = 'd'.repeat(48);
    expect(bookingManageConfigured()).toBe(true);
  });
});
