import './styles.css';
import { buildStartMarker, buildEndMarker } from './protocol.js';
import { playDtmfSequence } from './dtmf.js';

const app = document.querySelector('#app');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shell(inner, eyebrow = 'ALLEY GAITOR / SESSION CONTROL') {
  return `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">${eyebrow}</p>
        <h1>Run sessions</h1>
      </header>
      ${inner}
    </main>
  `;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function relationshipLabel(value) {
  return ({
    individual: 'Individual',
    family: 'Family',
    friends: 'Friends',
    colleagues: 'Work colleagues',
    other: 'Other',
  })[value] ?? value;
}

function normalizeBooking(row) {
  return {
    id: row.id,
    reference: row.public_reference,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    relationship: row.relationship,
    artworkMode: row.artwork_mode,
    participants: (row.participants || []).map((participant) => ({
      id: participant.id,
      artworkName: participant.artworkName,
      position: participant.position,
      recordingCode: participant.recordingCode,
      recordingState: participant.recordingStatus === 'recorded' ? 'complete' : participant.recordingStatus,
      visualisation: participant.visualisationId,
    })),
  };
}

function bookingProgress(booking) {
  const complete = booking.participants.filter((participant) => participant.recordingState === 'complete').length;
  return {
    complete,
    total: booking.participants.length,
    finished: complete === booking.participants.length,
  };
}

async function sessionFetch(path, options = {}) {
  return fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
}

function renderLogin(message = '') {
  app.innerHTML = shell(`
    <a class="back-link" href="/">← Home</a>
    <section class="card form-card">
      <h2 class="section-title">Session helper sign in</h2>
      <p class="subtle">Enter the access code you were given for running sessions.</p>
      <form id="session-login-form">
        <label>
          Access code
          <input name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="16" required>
        </label>
        <button class="primary" type="submit">OPEN SESSION CONTROL</button>
        <div id="login-status" class="status error">${escapeHtml(message)}</div>
      </form>
    </section>
  `);

  document.querySelector('#session-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector('#login-status');
    const button = form.querySelector('button[type="submit"]');
    const code = String(new FormData(form).get('code') || '').trim().toUpperCase();

    button.disabled = true;
    status.textContent = 'Signing in…';

    try {
      const response = await sessionFetch('/api/session/login', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'That access code was not accepted.' : 'Could not sign in.');
      }
      await renderSessions();
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
}

async function logout() {
  try {
    await sessionFetch('/api/session/logout', { method: 'POST' });
  } finally {
    renderLogin();
  }
}

async function renderSessions() {
  app.innerHTML = shell('<section class="card"><p>Loading sessions…</p></section>');

  let response;
  try {
    response = await sessionFetch('/api/session/bookings');
  } catch {
    return renderLogin('Could not reach Session control.');
  }

  if (response.status === 401) return renderLogin();
  if (!response.ok) return renderLogin('Could not load sessions.');

  const payload = await response.json();
  const helper = payload.helper || {};
  const bookings = (payload.bookings || []).map(normalizeBooking);

  if (!bookings.length) {
    app.innerHTML = shell(`
      <div class="operator-tools">
        <span class="subtle">Signed in as ${escapeHtml(helper.displayName || 'helper')}</span>
        <button id="logout" class="small-button">LOG OUT</button>
      </div>
      <section class="card">
        <h2 class="section-title">No upcoming sessions</h2>
        <p class="subtle">There are no active bookings in the next 14 days.</p>
      </section>
    `);
    document.querySelector('#logout').addEventListener('click', logout);
    return;
  }

  let selectedBookingId = bookings[0].id;
  let selectedParticipantId = bookings[0].participants[0]?.id;
  let busy = false;

  function selectedBooking() {
    return bookings.find((booking) => booking.id === selectedBookingId);
  }

  function selectedParticipant() {
    return selectedBooking()?.participants.find((participant) => participant.id === selectedParticipantId);
  }

  async function playMarker(kind) {
    if (busy) return;
    const participant = selectedParticipant();
    if (!participant) return;

    const sequence = kind === 'start'
      ? buildStartMarker(participant.recordingCode)
      : buildEndMarker(participant.recordingCode);

    busy = true;
    draw();

    try {
      await playDtmfSequence(sequence);
      const saveResponse = await sessionFetch('/api/session/recording-event', {
        method: 'POST',
        body: JSON.stringify({ participantId: participant.id, eventType: kind }),
      });

      if (saveResponse.status === 401) {
        renderLogin('Your session access has expired.');
        return;
      }
      if (!saveResponse.ok) throw new Error('Marker played, but the status could not be saved.');

      participant.recordingState = kind === 'start' ? 'started' : 'complete';
    } catch (error) {
      alert(error.message);
    } finally {
      busy = false;
      draw();
    }
  }

  function draw() {
    const booking = selectedBooking();
    const participant = selectedParticipant();
    if (!booking || !participant) return;

    const progress = bookingProgress(booking);
    const started = participant.recordingState === 'started';
    const complete = participant.recordingState === 'complete';

    app.innerHTML = shell(`
      <div class="operator-tools">
        <span class="subtle">Signed in as ${escapeHtml(helper.displayName || 'helper')}</span>
        <button id="logout" class="small-button">LOG OUT</button>
      </div>

      <section class="booking-strip" aria-label="Upcoming sessions">
        ${bookings.map((item) => {
          const itemProgress = bookingProgress(item);
          return `
            <button class="booking-pill ${item.id === booking.id ? 'selected' : ''}" data-booking="${item.id}">
              <strong>${formatTime(item.startsAt)}</strong>
              <span>${escapeHtml(item.reference)}</span>
              <small>${itemProgress.complete}/${itemProgress.total} recorded</small>
            </button>
          `;
        }).join('')}
      </section>

      <section class="booking-summary">
        <div>
          <p class="eyebrow">${escapeHtml(booking.reference)}</p>
          <h2>${relationshipLabel(booking.relationship)}</h2>
          <p class="subtle">${booking.participants.length} participant${booking.participants.length === 1 ? '' : 's'} · ${booking.durationMinutes} min slot</p>
        </div>
        <div class="mode-badge">${booking.artworkMode === 'group' ? 'GROUP ARTWORK' : 'INDIVIDUAL ARTWORKS'}</div>
      </section>

      <section class="participant-tabs" aria-label="Participants">
        ${booking.participants.map((item, index) => `
          <button class="participant-tab ${item.id === participant.id ? 'selected' : ''} ${item.recordingState}" data-participant="${item.id}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(item.artworkName)}</strong>
            <small>${item.recordingState === 'complete' ? 'Recorded' : item.recordingState === 'started' ? 'Recording' : 'Not recorded'}</small>
          </button>
        `).join('')}
      </section>

      <section class="card">
        <div class="progress">Participant ${booking.participants.indexOf(participant) + 1} of ${booking.participants.length}</div>
        <h3>${escapeHtml(participant.artworkName)}</h3>
        <p class="code">Recording ${escapeHtml(participant.recordingCode)}${participant.visualisation ? ` · ${escapeHtml(participant.visualisation)}` : ''}</p>

        <button id="start" class="primary" ${busy || started || complete ? 'disabled' : ''}>
          ${busy && !started ? 'PLAYING START MARKER…' : `SPOT / START ${escapeHtml(participant.artworkName.toUpperCase())}`}
        </button>
        <button id="end" class="danger" ${busy || !started ? 'disabled' : ''}>
          ${busy && started ? 'PLAYING END MARKER…' : 'END SESSION'}
        </button>

        <div class="status ${participant.recordingState}">
          ${busy ? 'Keep the iPhone speaker audible until the marker finishes.' : started ? 'START marker sent. Walk the bicycle now.' : complete ? 'Recording complete.' : 'Start the Android recorder, then play the START marker.'}
        </div>
      </section>

      <section class="booking-footer">
        <span>${progress.complete}/${progress.total} participant recordings complete</span>
        <strong>${progress.finished ? 'BOOKING COMPLETE' : 'BOOKING IN PROGRESS'}</strong>
      </section>
    `);

    document.querySelector('#logout').addEventListener('click', logout);
    document.querySelectorAll('[data-booking]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedBookingId = button.dataset.booking;
        selectedParticipantId = selectedBooking().participants[0]?.id;
        draw();
      });
    });
    document.querySelectorAll('[data-participant]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedParticipantId = button.dataset.participant;
        draw();
      });
    });
    document.querySelector('#start')?.addEventListener('click', () => playMarker('start'));
    document.querySelector('#end')?.addEventListener('click', () => playMarker('end'));
  }

  draw();
}

renderSessions();
