import './styles.css';
import { buildStartMarker, buildEndMarker } from './protocol.js';
import { playDtmfSequence } from './dtmf.js';
import { bookingDurationMinutes, bookingProgress, createBooking } from './model.js';

const bookings = [
  createBooking({
    id: 'booking-1',
    reference: 'AG-00418',
    startsAt: '2026-10-05T14:00:00+01:00',
    relationship: 'friends',
    leadName: 'Alex Smith',
    artworkMode: 'individual',
    participants: [
      { id: 'p1', artworkName: 'Charlie', recordingCode: '48231', visualisation: 'VIS01' },
      { id: 'p2', artworkName: 'Jo', recordingCode: '65194', visualisation: 'VIS04' },
      { id: 'p3', artworkName: 'Sam', recordingCode: '29473', visualisation: 'VIS02' },
    ],
  }),
  createBooking({
    id: 'booking-2',
    reference: 'AG-00419',
    startsAt: '2026-10-05T14:15:00+01:00',
    relationship: 'family',
    leadName: 'Maya Patel',
    artworkMode: 'group',
    participants: [
      { id: 'p4', artworkName: 'Maya', recordingCode: '73510' },
      { id: 'p5', artworkName: 'Chris', recordingCode: '86422' },
    ],
  }),
];

let selectedBookingId = bookings[0].id;
let selectedParticipantId = bookings[0].participants[0].id;
let busy = false;

const app = document.querySelector('#app');

function selectedBooking() {
  return bookings.find((booking) => booking.id === selectedBookingId);
}

function selectedParticipant() {
  return selectedBooking().participants.find((participant) => participant.id === selectedParticipantId);
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function relationshipLabel(value) {
  return {
    individual: 'Individual',
    family: 'Family',
    friends: 'Friends',
    colleagues: 'Work colleagues',
    other: 'Other',
  }[value] ?? value;
}

function render() {
  const booking = selectedBooking();
  const participant = selectedParticipant();
  const progress = bookingProgress(booking);
  const started = participant.recordingState === 'started';
  const complete = participant.recordingState === 'complete';

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR / OPERATOR</p>
        <h1>Today</h1>
        <p class="subtle">Stage 3 prototype · booking → participant → DTMF recording</p>
      </header>

      <section class="booking-strip" aria-label="Today's bookings">
        ${bookings.map((item) => {
          const itemProgress = bookingProgress(item);
          return `
            <button class="booking-pill ${item.id === booking.id ? 'selected' : ''}" data-booking="${item.id}">
              <strong>${formatTime(item.startsAt)}</strong>
              <span>${item.reference}</span>
              <small>${itemProgress.complete}/${itemProgress.total} recorded</small>
            </button>
          `;
        }).join('')}
      </section>

      <section class="booking-summary">
        <div>
          <p class="eyebrow">${booking.reference}</p>
          <h2>${booking.leadName}</h2>
          <p class="subtle">${relationshipLabel(booking.relationship)} · ${booking.participants.length} participant${booking.participants.length === 1 ? '' : 's'} · ${bookingDurationMinutes(booking.participants.length)} min slot</p>
        </div>
        <div class="mode-badge">${booking.artworkMode === 'group' ? 'GROUP ARTWORK' : 'INDIVIDUAL ARTWORKS'}</div>
      </section>

      <section class="participant-tabs" aria-label="Participants">
        ${booking.participants.map((item, index) => `
          <button class="participant-tab ${item.id === participant.id ? 'selected' : ''} ${item.recordingState}" data-participant="${item.id}">
            <span>${index + 1}</span>
            <strong>${item.artworkName}</strong>
            <small>${stateLabel(item.recordingState)}</small>
          </button>
        `).join('')}
      </section>

      <section class="card">
        <div class="progress">Participant ${booking.participants.indexOf(participant) + 1} of ${booking.participants.length}</div>
        <h3>${participant.artworkName}</h3>
        <p class="code">Recording ${participant.recordingCode}${participant.visualisation ? ` · ${participant.visualisation}` : ''}</p>

        <button id="start" class="primary" ${busy || started || complete ? 'disabled' : ''}>
          ${busy && !started ? 'PLAYING START MARKER…' : `SPOT / START ${participant.artworkName.toUpperCase()}`}
        </button>

        <button id="end" class="danger" ${busy || !started ? 'disabled' : ''}>
          ${busy && started ? 'PLAYING END MARKER…' : 'END SESSION'}
        </button>

        <div class="status ${participant.recordingState}">
          ${statusText(participant)}
        </div>
      </section>

      <section class="booking-footer">
        <span>${progress.complete}/${progress.total} participant recordings complete</span>
        <strong>${progress.finished ? 'BOOKING COMPLETE' : 'BOOKING IN PROGRESS'}</strong>
      </section>

      <details class="debug">
        <summary>Marker details</summary>
        <p>START <code>${buildStartMarker(participant.recordingCode)}</code></p>
        <p>END <code>${buildEndMarker(participant.recordingCode)}</code></p>
        <p>Tones: 140 ms · gaps: 70 ms</p>
      </details>
    </main>
  `;

  document.querySelectorAll('[data-booking]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedBookingId = button.dataset.booking;
      selectedParticipantId = selectedBooking().participants[0].id;
      render();
    });
  });

  document.querySelectorAll('[data-participant]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedParticipantId = button.dataset.participant;
      render();
    });
  });

  document.querySelector('#start')?.addEventListener('click', () => playMarker('start'));
  document.querySelector('#end')?.addEventListener('click', () => playMarker('end'));
}

function stateLabel(state) {
  return {
    pending: 'Not recorded',
    started: 'Recording',
    complete: 'Recorded',
  }[state];
}

function statusText(participant) {
  if (busy) return 'Keep the iPhone speaker audible until the complete marker finishes.';
  if (participant.recordingState === 'started') return `START sent for ${participant.artworkName}. Walk the bicycle now.`;
  if (participant.recordingState === 'complete') return `END sent for ${participant.artworkName}. Recording marked complete.`;
  return 'Start the Android recorder, then play the START marker.';
}

async function playMarker(kind) {
  if (busy) return;
  const participant = selectedParticipant();
  const sequence = kind === 'start'
    ? buildStartMarker(participant.recordingCode)
    : buildEndMarker(participant.recordingCode);

  busy = true;
  render();

  try {
    await playDtmfSequence(sequence);
    participant.recordingState = kind === 'start' ? 'started' : 'complete';
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    busy = false;
    render();
  }
}

render();
