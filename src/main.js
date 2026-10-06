import './styles.css';
import { buildStartMarker, buildEndMarker } from './protocol.js';
import { playDtmfSequence } from './dtmf.js';

const app = document.querySelector('#app');
const OPERATOR_TOKEN_KEY = 'alley-gaitor-operator-token';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function navigate(path) {
  history.pushState({}, '', path);
  route();
}

window.addEventListener('popstate', route);

document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-route]');
  if (!link) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});

function shell(inner, eyebrow = 'ALLEY GAITOR') {
  return `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">${eyebrow}</p>
        <h1>Alley Gaitor</h1>
      </header>
      ${inner}
    </main>
  `;
}

function renderHome() {
  app.innerHTML = shell(`
    <section class="card">
      <h2 class="section-title">Bicycle walk sessions</h2>
      <p class="subtle">Book a short session, or open the private operator view on the recording phone.</p>
      <a class="action-link primary-link" href="/book" data-route>BOOK A SESSION</a>
      <a class="action-link secondary-link" href="/operator" data-route>OPERATOR</a>
    </section>
  `);
}

function participantFields(count) {
  return Array.from({ length: count }, (_, index) => `
    <fieldset class="participant-form">
      <legend>Participant ${index + 1}</legend>
      <label>
        Name for artwork
        <input name="participant_${index}_artworkName" maxlength="80" required placeholder="Nickname, initials or first name">
      </label>
      <div class="form-grid two">
        <label>
          T-shirt size
          <select name="participant_${index}_tShirtSize">
            <option value="">Choose later</option>
            <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
          </select>
        </label>
        <label>
          Visualisation
          <select name="participant_${index}_visualisationId">
            <option value="VIS01">Visualisation 1</option>
            <option value="VIS02">Visualisation 2</option>
            <option value="VIS03">Visualisation 3</option>
            <option value="VIS04">Visualisation 4</option>
          </select>
        </label>
      </div>
    </fieldset>
  `).join('');
}

function renderBook() {
  app.innerHTML = shell(`
    <a class="back-link" href="/" data-route>← Home</a>
    <section class="card form-card">
      <h2 class="section-title">Book a session</h2>
      <p class="subtle">UK bookings only for the current trial. Each participant gets their own bicycle recording.</p>

      <form id="booking-form">
        <div class="form-grid two">
          <label>Lead name<input name="leadName" maxlength="120" required></label>
          <label>Email<input name="leadEmail" type="email" maxlength="200" required></label>
        </div>

        <label>Phone <span class="optional">optional</span><input name="leadPhone" maxlength="50"></label>

        <div class="form-grid two">
          <label>
            Relationship
            <select name="relationship" required>
              <option value="individual">Individual</option>
              <option value="family">Family</option>
              <option value="friends">Friends</option>
              <option value="colleagues">Work colleagues</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Number of participants
            <select id="participant-count" name="participantCount">
              <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
            </select>
          </label>
        </div>

        <label>
          Artwork mode
          <select name="artworkMode" required>
            <option value="individual">Individual artwork(s)</option>
            <option value="group">One group artwork</option>
          </select>
        </label>

        <label>
          Session date and time
          <input name="startsAt" type="datetime-local" required>
        </label>
        <p class="field-note">For this first live version you choose a requested time directly. The next scheduler stage will show only available slots.</p>

        <h3 class="form-heading">Delivery address</h3>
        <label>Address line 1<input name="addressLine1" maxlength="200" required></label>
        <label>Address line 2 <span class="optional">optional</span><input name="addressLine2" maxlength="200"></label>
        <div class="form-grid two">
          <label>Town / city<input name="townCity" maxlength="120" required></label>
          <label>County <span class="optional">optional</span><input name="county" maxlength="120"></label>
        </div>
        <label>Postcode<input name="postcode" maxlength="20" required></label>

        <h3 class="form-heading">Participants</h3>
        <div id="participant-fields">${participantFields(1)}</div>

        <label class="consent-row">
          <input name="privacyAcknowledged" type="checkbox" required>
          <span>I understand these details are used to manage the session and fulfil the artwork/T-shirt order.</span>
        </label>

        <button class="primary" type="submit">CREATE BOOKING</button>
        <div id="booking-status" class="status" aria-live="polite"></div>
      </form>
    </section>
  `, 'ALLEY GAITOR / BOOKING');

  const countSelect = document.querySelector('#participant-count');
  countSelect.addEventListener('change', () => {
    document.querySelector('#participant-fields').innerHTML = participantFields(Number(countSelect.value));
  });

  document.querySelector('#booking-form').addEventListener('submit', submitBooking);
}

async function submitBooking(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector('#booking-status');
  const submit = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const count = Number(data.get('participantCount'));

  const localStart = data.get('startsAt');
  const startsAt = localStart ? new Date(localStart).toISOString() : '';

  const participants = Array.from({ length: count }, (_, index) => ({
    artworkName: data.get(`participant_${index}_artworkName`) || '',
    tShirtSize: data.get(`participant_${index}_tShirtSize`) || '',
    visualisationId: data.get(`participant_${index}_visualisationId`) || '',
  }));

  const payload = {
    leadName: data.get('leadName'),
    leadEmail: data.get('leadEmail'),
    leadPhone: data.get('leadPhone'),
    relationship: data.get('relationship'),
    artworkMode: data.get('artworkMode'),
    startsAt,
    addressLine1: data.get('addressLine1'),
    addressLine2: data.get('addressLine2'),
    townCity: data.get('townCity'),
    county: data.get('county'),
    postcode: data.get('postcode'),
    participants,
  };

  submit.disabled = true;
  status.textContent = 'Creating booking…';

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.error === 'slot_unavailable') throw new Error('That time is already booked. Please choose another time.');
      if (result.error === 'validation_failed') throw new Error(`Please check: ${(result.fields || []).join(', ')}`);
      throw new Error('The booking could not be created. Please try again.');
    }

    form.innerHTML = `
      <div class="success-panel">
        <p class="eyebrow">BOOKING CREATED</p>
        <h2>${escapeHtml(result.booking.reference)}</h2>
        <p>${new Date(result.booking.startsAt).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>
        <p>${result.booking.participantCount} participant${result.booking.participantCount === 1 ? '' : 's'} · ${result.booking.durationMinutes} minute slot</p>
        <p class="subtle">Keep the booking reference. Email confirmation will be added in a later stage.</p>
        <a class="action-link secondary-link" href="/" data-route>DONE</a>
      </div>`;
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
    submit.disabled = false;
  }
}

function renderOperatorLogin(message = '') {
  app.innerHTML = shell(`
    <a class="back-link" href="/" data-route>← Home</a>
    <section class="card form-card operator-login">
      <h2 class="section-title">Operator access</h2>
      <p class="subtle">Enter the private operator token stored in Netlify. It is kept only for this browser session.</p>
      <form id="operator-login-form">
        <label>Operator token<input name="token" type="password" autocomplete="off" required></label>
        <button class="primary" type="submit">OPEN OPERATOR</button>
        <div class="status error">${escapeHtml(message)}</div>
      </form>
    </section>
  `, 'ALLEY GAITOR / PRIVATE');

  document.querySelector('#operator-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get('token').trim();
    sessionStorage.setItem(OPERATOR_TOKEN_KEY, token);
    await renderOperator();
  });
}

async function apiOperator(path, options = {}) {
  const token = sessionStorage.getItem(OPERATOR_TOKEN_KEY) || '';
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${token}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(path, { ...options, headers });
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
    participants: (row.participants || []).map((p) => ({
      id: p.id,
      artworkName: p.artworkName,
      position: p.position,
      recordingCode: p.recordingCode,
      recordingState: p.recordingStatus === 'recorded' ? 'complete' : p.recordingStatus,
      visualisation: p.visualisationId,
    })),
  };
}

function bookingProgress(booking) {
  const complete = booking.participants.filter((p) => p.recordingState === 'complete').length;
  return { complete, total: booking.participants.length, finished: complete === booking.participants.length };
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function relationshipLabel(value) {
  return ({ individual: 'Individual', family: 'Family', friends: 'Friends', colleagues: 'Work colleagues', other: 'Other' })[value] ?? value;
}

function stateLabel(state) {
  return ({ pending: 'Not recorded', started: 'Recording', complete: 'Recorded', processed: 'Processed', failed: 'Failed' })[state] || state;
}

async function renderOperator() {
  const token = sessionStorage.getItem(OPERATOR_TOKEN_KEY);
  if (!token) return renderOperatorLogin();

  app.innerHTML = shell('<section class="card"><p>Loading bookings…</p></section>', 'ALLEY GAITOR / OPERATOR');

  let response;
  try {
    response = await apiOperator('/api/operator/bookings');
  } catch {
    return renderOperatorLogin('Could not reach the operator API.');
  }

  if (response.status === 401 || response.status === 503) {
    sessionStorage.removeItem(OPERATOR_TOKEN_KEY);
    return renderOperatorLogin(response.status === 401 ? 'That operator token was not accepted.' : 'Operator access is not configured.');
  }

  if (!response.ok) return renderOperatorLogin('Could not load bookings.');
  const payload = await response.json();
  const bookings = (payload.bookings || []).map(normalizeBooking);

  if (!bookings.length) {
    app.innerHTML = shell(`
      <div class="operator-tools"><a class="back-link" href="/" data-route>← Home</a><button id="logout" class="small-button">LOG OUT</button></div>
      <section class="card"><h2 class="section-title">No upcoming bookings</h2><p class="subtle">Create a test booking from the public booking form, then return here.</p></section>
    `, 'ALLEY GAITOR / OPERATOR');
    document.querySelector('#logout').addEventListener('click', logoutOperator);
    return;
  }

  let selectedBookingId = bookings[0].id;
  let selectedParticipantId = bookings[0].participants[0]?.id;
  let busy = false;

  function selectedBooking() { return bookings.find((booking) => booking.id === selectedBookingId); }
  function selectedParticipant() { return selectedBooking()?.participants.find((p) => p.id === selectedParticipantId); }

  function draw() {
    const booking = selectedBooking();
    const participant = selectedParticipant();
    if (!booking || !participant) return;
    const progress = bookingProgress(booking);
    const started = participant.recordingState === 'started';
    const complete = participant.recordingState === 'complete';

    app.innerHTML = shell(`
      <div class="operator-tools"><a class="back-link" href="/" data-route>← Home</a><button id="logout" class="small-button">LOG OUT</button></div>
      <section class="booking-strip" aria-label="Bookings">
        ${bookings.map((item) => {
          const p = bookingProgress(item);
          return `<button class="booking-pill ${item.id === booking.id ? 'selected' : ''}" data-booking="${item.id}">
            <strong>${formatTime(item.startsAt)}</strong><span>${escapeHtml(item.reference)}</span><small>${p.complete}/${p.total} recorded</small>
          </button>`;
        }).join('')}
      </section>

      <section class="booking-summary">
        <div><p class="eyebrow">${escapeHtml(booking.reference)}</p><h2>${relationshipLabel(booking.relationship)}</h2>
        <p class="subtle">${booking.participants.length} participant${booking.participants.length === 1 ? '' : 's'} · ${booking.durationMinutes} min slot</p></div>
        <div class="mode-badge">${booking.artworkMode === 'group' ? 'GROUP ARTWORK' : 'INDIVIDUAL ARTWORKS'}</div>
      </section>

      <section class="participant-tabs">
        ${booking.participants.map((item, index) => `<button class="participant-tab ${item.id === participant.id ? 'selected' : ''} ${item.recordingState}" data-participant="${item.id}">
          <span>${index + 1}</span><strong>${escapeHtml(item.artworkName)}</strong><small>${stateLabel(item.recordingState)}</small>
        </button>`).join('')}
      </section>

      <section class="card">
        <div class="progress">Participant ${booking.participants.indexOf(participant) + 1} of ${booking.participants.length}</div>
        <h3>${escapeHtml(participant.artworkName)}</h3>
        <p class="code">Recording ${participant.recordingCode}${participant.visualisation ? ` · ${escapeHtml(participant.visualisation)}` : ''}</p>
        <button id="start" class="primary" ${busy || started || complete ? 'disabled' : ''}>${busy && !started ? 'PLAYING START MARKER…' : `SPOT / START ${escapeHtml(participant.artworkName.toUpperCase())}`}</button>
        <button id="end" class="danger" ${busy || !started ? 'disabled' : ''}>${busy && started ? 'PLAYING END MARKER…' : 'END SESSION'}</button>
        <div class="status ${participant.recordingState}">${busy ? 'Keep the iPhone speaker audible until the marker finishes.' : started ? 'START marker sent. Walk the bicycle now.' : complete ? 'Recording complete.' : 'Start the Android recorder, then play the START marker.'}</div>
      </section>

      <section class="booking-footer"><span>${progress.complete}/${progress.total} participant recordings complete</span><strong>${progress.finished ? 'BOOKING COMPLETE' : 'BOOKING IN PROGRESS'}</strong></section>
      <details class="debug"><summary>Marker details</summary><p>START <code>${buildStartMarker(participant.recordingCode)}</code></p><p>END <code>${buildEndMarker(participant.recordingCode)}</code></p></details>
    `, 'ALLEY GAITOR / OPERATOR');

    document.querySelector('#logout').addEventListener('click', logoutOperator);
    document.querySelectorAll('[data-booking]').forEach((button) => button.addEventListener('click', () => {
      selectedBookingId = button.dataset.booking;
      selectedParticipantId = selectedBooking().participants[0]?.id;
      draw();
    }));
    document.querySelectorAll('[data-participant]').forEach((button) => button.addEventListener('click', () => {
      selectedParticipantId = button.dataset.participant;
      draw();
    }));
    document.querySelector('#start')?.addEventListener('click', () => playMarker('start'));
    document.querySelector('#end')?.addEventListener('click', () => playMarker('end'));
  }

  async function playMarker(kind) {
    if (busy) return;
    const participant = selectedParticipant();
    const sequence = kind === 'start' ? buildStartMarker(participant.recordingCode) : buildEndMarker(participant.recordingCode);
    busy = true;
    draw();
    try {
      await playDtmfSequence(sequence);
      const response = await apiOperator('/api/operator/recording-event', {
        method: 'POST',
        body: JSON.stringify({ participantId: participant.id, eventType: kind }),
      });
      if (response.status === 401) throw new Error('Operator session expired.');
      if (!response.ok) throw new Error('The marker played, but its status could not be saved.');
      participant.recordingState = kind === 'start' ? 'started' : 'complete';
    } catch (error) {
      alert(error.message);
    } finally {
      busy = false;
      draw();
    }
  }

  draw();
}

function logoutOperator() {
  sessionStorage.removeItem(OPERATOR_TOKEN_KEY);
  renderOperatorLogin();
}

function route() {
  if (location.pathname === '/book') return renderBook();
  if (location.pathname === '/operator') return renderOperator();
  return renderHome();
}

route();
