import { getDb, json } from './_db.mjs';

const TIME_ZONE = 'Europe/London';
const OPEN_MINUTES = 10 * 60;
const CLOSE_MINUTES = 18 * 60;
const STEP_MINUTES = 5;
const MAX_DAYS_AHEAD = 60;

function durationForCount(count) {
  if (count === 1) return 5;
  if (count <= 3) return 10;
  return 15;
}

function validDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

function zonedParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function localDateTimeToUtc(dateString, minuteOfDay) {
  const [year, month, day] = dateString.split('-').map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetAsUtc;

  for (let i = 0; i < 3; i += 1) {
    const observed = zonedParts(new Date(guess));
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second || 0);
    guess += targetAsUtc - observedAsUtc;
  }

  return new Date(guess);
}

function londonDateString(date = new Date()) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function formatSlot(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
  }

  const url = new URL(request.url);
  const dateString = url.searchParams.get('date') || '';
  const participantCount = Number(url.searchParams.get('participants') || '1');

  if (!validDateString(dateString) || !Number.isInteger(participantCount) || participantCount < 1 || participantCount > 4) {
    return json({ error: 'validation_failed' }, 400);
  }

  const today = londonDateString();
  const todayUtc = localDateTimeToUtc(today, 0);
  const requestedUtc = localDateTimeToUtc(dateString, 0);
  const daysAhead = Math.round((requestedUtc - todayUtc) / 86400000);

  if (daysAhead < 0 || daysAhead > MAX_DAYS_AHEAD) {
    return json({ date: dateString, participantCount, durationMinutes: durationForCount(participantCount), slots: [] });
  }

  const durationMinutes = durationForCount(participantCount);
  const dayStart = localDateTimeToUtc(dateString, 0);
  const nextDay = localDateTimeToUtc(dateString, 24 * 60);

  try {
    const sql = getDb();
    if (!sql) return json({ error: 'database_not_configured' }, 503);

    const bookings = await sql`
      select starts_at, duration_minutes
      from bookings
      where status not in ('cancelled', 'no_show')
        and starts_at >= ${dayStart}
        and starts_at < ${nextDay}
      order by starts_at asc
    `;

    const now = Date.now();
    const slots = [];

    for (let minute = OPEN_MINUTES; minute + durationMinutes <= CLOSE_MINUTES; minute += STEP_MINUTES) {
      const start = localDateTimeToUtc(dateString, minute);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      if (start.getTime() <= now + 5 * 60000) continue;

      const overlaps = bookings.some((booking) => {
        const bookedStart = new Date(booking.starts_at);
        const bookedEnd = new Date(bookedStart.getTime() + Number(booking.duration_minutes) * 60000);
        return start < bookedEnd && end > bookedStart;
      });

      if (!overlaps) {
        slots.push({
          startsAt: start.toISOString(),
          label: formatSlot(start),
        });
      }
    }

    return json({
      date: dateString,
      participantCount,
      durationMinutes,
      timeZone: TIME_ZONE,
      openingHours: '10:00–18:00',
      slots,
    });
  } catch (error) {
    console.error('availability failed', error);
    return json({ error: 'database_unavailable' }, 503);
  }
};

export const config = {
  path: '/api/availability',
};
