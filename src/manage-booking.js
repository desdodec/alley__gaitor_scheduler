import './styles.css';

const app = document.querySelector('#app');
const TOKEN_KEY = 'alley-gaitor-manage-token';
let booking = null;
let selectedStart = '';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shell(inner) {
  return `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR</p>
        <h1>Manage booking</h1>
      </header>
      ${inner}
    </main>
  `;
}

function londonDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function londonDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function plusDaysDateString(days) {
  return londonDateString(new Date(Date.now() + days * 86400000));
}

function tokenFromHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('token') || '';
}

function getToken() {
  const fromHash = tokenFromHash();
  if (fromHash) {
    sessionStorage.setItem(TOKEN_KEY, fromHash);
    history.replaceState({}, '', `${location.pathname}${location.search}`);
    return fromHash;
  }
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function api(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body) headers.set('content-type', 'application/json');
  return fetch(path, { ...options, headers });
}

function renderError(message) {
  app.innerHTML = shell(`
    <a class="back-link" href="/">← Home</a>
    <section class="card">
      <h2 class="section-title">We couldn't open this booking</h2>
      <p class="subtle">${escapeHtml(message)}</p>
      <p class="subtle">Use the secure Manage booking link from your confirmation email. Your booking reference remains the fallback if you need help.</p>
    </section>
  `);
}

function renderBooking(message = '') {
  const cancelled = booking.status === 'cancelled';
  const participantNames = booking.participants.map((participant) => escapeHtml(participant.artworkName)).join(', ');

  app.innerHTML = shell(`
    <a class="back-link" href="/">← Home</a>
    <section class="card form-card">
      <p class="eyebrow">BOOKING ${escapeHtml(booking.reference)}</p>
      <h2 class="section-title">${cancelled ? 'Booking cancelled' : 'Your session'}</h2>
      <p><strong>Date and time:</strong><br>${escapeHtml(londonDateTime(booking.startsAt))}</p>
      <p><strong>Session length:</strong> ${Number(booking.durationMinutes)} minutes</p>
      <p><strong>Participant${booking.participantCount === 1 ? '' : 's'}:</strong> ${participantNames}</p>
      <p class="field-note">Keep booking reference <strong>${escapeHtml(booking.reference)}</strong> as your fallback.</p>
      ${message ? `<div class="status">${escapeHtml(message)}</div>` : ''}
    </section>

    ${cancelled ? '' : `
      <section class="card form-card" style="margin-top:18px">
        <h2 class="section-title">Reschedule</h2>
        <p class="subtle">Choose another available session time.</p>
        <label>
          New date
          <input id="reschedule-date" type="date" min="${londonDateString()}" max="${plusDaysDateString(60)}">
        </label>
        <div id="slot-status" class="status">Choose a date to see available times.</div>
        <div id="slot-list" class="slot-grid"></div>
        <button id="reschedule-button" class="primary" type="button" disabled>CONFIRM NEW TIME</button>
      </section>

      <section class="card form-card" style="margin-top:18px">
        <h2 class="section-title">Cancel</h2>
        <p class="subtle">This releases your session time for somebody else. A cancellation email will be sent to the booking email address.</p>
        <button id="cancel-button" class="danger" type="button">CANCEL BOOKING</button>
      </section>
    `}
  `);

  if (!cancelled) bindManagementControls();
}

async function loadSlots(dateString) {
  const status = document.querySelector('#slot-status');
  const list = document.querySelector('#slot-list');
  const button = document.querySelector('#reschedule-button');
  selectedStart = '';
  button.disabled = true;
  list.innerHTML = '';
  status.className = 'status';
  status.textContent = 'Loading available times…';

  try {
    const response = await fetch(`/api/availability?date=${encodeURIComponent(dateString)}&participants=${booking.participantCount}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'availability_failed');

    if (!data.slots.length) {
      status.textContent = 'No available times on this date.';
      return;
    }

    status.textContent = `${data.slots.length} available time${data.slots.length === 1 ? '' : 's'}.`;
    list.innerHTML = data.slots.map((slot) => `
      <button class="small-button slot-button" type="button" data-start="${escapeHtml(slot.startsAt)}">${escapeHtml(slot.label)}</button>
    `).join('');

    list.querySelectorAll('[data-start]').forEach((slotButton) => {
      slotButton.addEventListener('click', () => {
        list.querySelectorAll('[data-start]').forEach((item) => item.removeAttribute('aria-pressed'));
        slotButton.setAttribute('aria-pressed', 'true');
        selectedStart = slotButton.dataset.start;
        button.disabled = false;
      });
    });
  } catch {
    status.className = 'status error';
    status.textContent = 'Could not load availability. Please try again.';
  }
}

function bindManagementControls() {
  const dateInput = document.querySelector('#reschedule-date');
  const rescheduleButton = document.querySelector('#reschedule-button');
  const cancelButton = document.querySelector('#cancel-button');

  dateInput.addEventListener('change', () => {
    if (dateInput.value) loadSlots(dateInput.value);
  });

  rescheduleButton.addEventListener('click', async () => {
    if (!selectedStart) return;
    rescheduleButton.disabled = true;
    rescheduleButton.textContent = 'RESCHEDULING…';

    try {
      const response = await api('/api/manage-booking', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reschedule', startsAt: selectedStart }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === 'slot_unavailable') throw new Error('That time has just been taken. Please choose another slot.');
        throw new Error('Could not reschedule this booking.');
      }
      booking = data.booking;
      renderBooking(data.email?.sent ? 'Booking rescheduled. A confirmation email has been sent.' : 'Booking rescheduled. Keep your booking reference as confirmation.');
    } catch (error) {
      rescheduleButton.disabled = false;
      rescheduleButton.textContent = 'CONFIRM NEW TIME';
      const status = document.querySelector('#slot-status');
      status.className = 'status error';
      status.textContent = error.message;
    }
  });

  cancelButton.addEventListener('click', async () => {
    if (!window.confirm(`Cancel booking ${booking.reference}? This cannot be undone from this page.`)) return;
    cancelButton.disabled = true;
    cancelButton.textContent = 'CANCELLING…';

    try {
      const response = await api('/api/manage-booking', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error('Could not cancel this booking.');
      booking = data.booking;
      renderBooking(data.email?.sent ? 'Booking cancelled. A confirmation email has been sent.' : 'Booking cancelled. Keep your booking reference as confirmation.');
    } catch (error) {
      cancelButton.disabled = false;
      cancelButton.textContent = 'CANCEL BOOKING';
      window.alert(error.message);
    }
  });
}

async function start() {
  if (!getToken()) {
    renderError('This page needs the secure link from your booking confirmation email.');
    return;
  }

  app.innerHTML = shell('<section class="card"><p>Opening your booking…</p></section>');

  try {
    const response = await api('/api/manage-booking');
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem(TOKEN_KEY);
      throw new Error(response.status === 401 ? 'This manage link is invalid or has expired.' : 'The booking could not be loaded.');
    }
    booking = data.booking;
    renderBooking();
  } catch (error) {
    renderError(error.message);
  }
}

start();
