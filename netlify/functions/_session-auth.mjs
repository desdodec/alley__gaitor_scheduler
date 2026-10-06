import crypto from 'node:crypto';
import { json } from './_db.mjs';

const COOKIE_NAME = 'ag_session';
const SESSION_SECONDS = 12 * 60 * 60;

export function hashAccessCode(code) {
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
}

function secret() {
  const value = process.env.SESSION_COOKIE_SECRET;
  if (!value || value.length < 32) return null;
  return value;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createSessionCookie(helperId) {
  if (!secret()) throw new Error('SESSION_COOKIE_SECRET is not configured');
  const payload = Buffer.from(JSON.stringify({
    sub: helperId,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return '';
}

export function verifySession(request) {
  if (!secret()) {
    return { ok: false, response: json({ error: 'session_auth_not_configured' }, 503) };
  }

  const token = readCookie(request);
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, response: json({ error: 'unauthorized' }, 401) };
    }
    return { ok: true, helperId: decoded.sub };
  } catch {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }
}
