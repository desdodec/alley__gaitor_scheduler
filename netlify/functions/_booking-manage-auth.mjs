import crypto from 'node:crypto';

const TOKEN_LIFETIME_SECONDS = 365 * 24 * 60 * 60;

function secret() {
  const value = process.env.BOOKING_MANAGE_SECRET || process.env.SESSION_COOKIE_SECRET;
  if (!value || value.length < 32) return null;
  return value;
}

function sign(payload) {
  const value = secret();
  if (!value) throw new Error('Booking management secret is not configured');
  return crypto.createHmac('sha256', value).update(`booking-manage:${payload}`).digest('base64url');
}

export function bookingManageConfigured() {
  return Boolean(secret());
}

export function createBookingManageToken({ bookingId, reference, expiresAt } = {}) {
  if (!bookingId || !reference) throw new Error('bookingId and reference are required');
  if (!secret()) throw new Error('Booking management secret is not configured');

  const exp = expiresAt
    ? Math.floor(new Date(expiresAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;

  const payload = Buffer.from(JSON.stringify({
    sub: String(bookingId),
    ref: String(reference),
    exp,
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function verifyBookingManageToken(token) {
  if (!secret()) return { ok: false, error: 'booking_manage_not_configured' };
  if (typeof token !== 'string') return { ok: false, error: 'unauthorized' };

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return { ok: false, error: 'unauthorized' };

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'unauthorized' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.sub || !decoded.ref || !decoded.exp || decoded.exp < now) {
      return { ok: false, error: 'unauthorized' };
    }
    return {
      ok: true,
      bookingId: String(decoded.sub),
      reference: String(decoded.ref),
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    };
  } catch {
    return { ok: false, error: 'unauthorized' };
  }
}

export function bearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}
