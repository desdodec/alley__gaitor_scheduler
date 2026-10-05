const RELATIONSHIPS = new Set(['individual', 'family', 'friends', 'colleagues', 'other']);
const ARTWORK_MODES = new Set(['individual', 'group']);
const RECORDING_STATES = new Set(['pending', 'started', 'complete']);

export function createBooking(input) {
  const booking = {
    id: requiredText(input.id, 'booking id'),
    reference: requiredText(input.reference, 'booking reference'),
    startsAt: requiredText(input.startsAt, 'booking start time'),
    relationship: input.relationship,
    leadName: requiredText(input.leadName, 'lead name'),
    artworkMode: input.artworkMode,
    participants: (input.participants ?? []).map(createParticipant),
  };

  if (!RELATIONSHIPS.has(booking.relationship)) {
    throw new Error(`Invalid relationship: ${booking.relationship}`);
  }
  if (!ARTWORK_MODES.has(booking.artworkMode)) {
    throw new Error(`Invalid artwork mode: ${booking.artworkMode}`);
  }
  if (booking.participants.length < 1 || booking.participants.length > 4) {
    throw new Error('A booking must contain between 1 and 4 participants');
  }

  const codes = booking.participants.map((participant) => participant.recordingCode);
  if (new Set(codes).size !== codes.length) {
    throw new Error('Recording codes must be unique within a booking');
  }

  return booking;
}

export function createParticipant(input) {
  const participant = {
    id: requiredText(input.id, 'participant id'),
    artworkName: requiredText(input.artworkName, 'artwork name'),
    recordingCode: String(input.recordingCode ?? ''),
    visualisation: input.visualisation ?? null,
    recordingState: input.recordingState ?? 'pending',
  };

  if (!/^\d{5}$/.test(participant.recordingCode)) {
    throw new Error('Recording code must contain exactly five digits');
  }
  if (!RECORDING_STATES.has(participant.recordingState)) {
    throw new Error(`Invalid recording state: ${participant.recordingState}`);
  }
  if (participant.visualisation !== null && !['VIS01', 'VIS02', 'VIS03', 'VIS04'].includes(participant.visualisation)) {
    throw new Error(`Invalid visualisation: ${participant.visualisation}`);
  }

  return participant;
}

export function bookingDurationMinutes(participantCount) {
  if (participantCount <= 1) return 5;
  if (participantCount <= 3) return 10;
  return 15;
}

export function bookingProgress(booking) {
  const complete = booking.participants.filter((participant) => participant.recordingState === 'complete').length;
  return {
    complete,
    total: booking.participants.length,
    finished: complete === booking.participants.length,
  };
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}
