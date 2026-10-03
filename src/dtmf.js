const DTMF = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

let audioContext;

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    throw new Error('Web Audio is not supported in this browser.');
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export async function playDtmfSequence(sequence, options = {}) {
  const {
    toneMs = 140,
    gapMs = 70,
    level = 0.22,
  } = options;

  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  const startAt = context.currentTime + 0.05;
  const toneSeconds = toneMs / 1000;
  const gapSeconds = gapMs / 1000;
  const step = toneSeconds + gapSeconds;

  sequence.split('').forEach((symbol, index) => {
    const frequencies = DTMF[symbol];
    if (!frequencies) {
      throw new Error(`Unsupported DTMF symbol: ${symbol}`);
    }

    const begin = startAt + index * step;
    const end = begin + toneSeconds;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(level, begin + 0.01);
    gain.gain.setValueAtTime(level, Math.max(begin + 0.01, end - 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(context.destination);

    for (const frequency of frequencies) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, begin);
      oscillator.connect(gain);
      oscillator.start(begin);
      oscillator.stop(end + 0.01);
    }
  });

  const durationMs = sequence.length * (toneMs + gapMs) + 100;
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
