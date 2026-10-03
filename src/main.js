import './styles.css';
import { buildStartMarker, buildEndMarker } from './protocol.js';
import { playDtmfSequence } from './dtmf.js';

const participants = [
  { id: 'p1', name: 'Charlie', code: '48231' },
  { id: 'p2', name: 'Jo', code: '65194' },
  { id: 'p3', name: 'Sam', code: '29473' },
];

let activeIndex = 0;
let activeState = 'idle';
let busy = false;

const app = document.querySelector('#app');

function render() {
  const participant = participants[activeIndex];
  const isStarted = activeState === 'started';
  const isComplete = activeState === 'complete';
  const nextExists = activeIndex < participants.length - 1;

  app.innerHTML = `
    <section class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR / STAGE 1</p>
        <h1>Session Spotter</h1>
        <p class="subtle">Fake booking · Friends · ${participants.length} participants</p>
      </header>

      <section class="card">
        <div class="progress">Participant ${activeIndex + 1} of ${participants.length}</div>
        <h2>${participant.name}</h2>
        <p class="code">Recording ${participant.code}</p>

        <button id="start" class="primary" ${busy || isStarted || isComplete ? 'disabled' : ''}>
          ${busy && !isStarted ? 'PLAYING MARKER…' : `SPOT / START ${participant.name.toUpperCase()}`}
        </button>

        <button id="end" class="danger" ${busy || !isStarted ? 'disabled' : ''}>
          ${busy && isStarted ? 'PLAYING MARKER…' : 'END SESSION'}
        </button>

        <div class="status ${activeState}">
          ${statusText(participant)}
        </div>

        ${isComplete && nextExists ? '<button id="next" class="secondary">NEXT PARTICIPANT →</button>' : ''}
        ${isComplete && !nextExists ? '<div class="finished">All fake participant sessions complete.</div>' : ''}
      </section>

      <details class="debug">
        <summary>Marker details</summary>
        <p>START <code>${buildStartMarker(participant.code)}</code></p>
        <p>END <code>${buildEndMarker(participant.code)}</code></p>
        <p>Tones: 140 ms · gaps: 70 ms</p>
      </details>
    </section>
  `;

  document.querySelector('#start')?.addEventListener('click', () => playMarker('start'));
  document.querySelector('#end')?.addEventListener('click', () => playMarker('end'));
  document.querySelector('#next')?.addEventListener('click', () => {
    activeIndex += 1;
    activeState = 'idle';
    render();
  });
}

function statusText(participant) {
  if (busy) return 'Keep the iPhone speaker audible until the marker finishes.';
  if (activeState === 'started') return `START marker sent for ${participant.name}. Walk the bicycle now.`;
  if (activeState === 'complete') return `END marker sent for ${participant.name}. Session complete.`;
  return 'Start the Android recording first, then press the button below.';
}

async function playMarker(kind) {
  if (busy) return;
  const participant = participants[activeIndex];
  const sequence = kind === 'start'
    ? buildStartMarker(participant.code)
    : buildEndMarker(participant.code);

  busy = true;
  render();

  try {
    await playDtmfSequence(sequence);
    activeState = kind === 'start' ? 'started' : 'complete';
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    busy = false;
    render();
  }
}

render();
