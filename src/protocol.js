export const HEADER = '##*#';
export const FOOTER = '#*##';
export const START_TYPE = '1';
export const END_TYPE = '2';

export function validateRecordingCode(code) {
  if (!/^\d{5}$/.test(code)) {
    throw new Error('Recording code must be exactly 5 decimal digits.');
  }
  return code;
}

export function checksum(type, code) {
  validateRecordingCode(code);
  if (![START_TYPE, END_TYPE].includes(type)) {
    throw new Error('Marker type must be 1 (start) or 2 (end).');
  }

  const total = Number(type) + [...code].reduce((sum, digit) => sum + Number(digit), 0);
  return String(total % 10);
}

export function buildMarker(type, code) {
  validateRecordingCode(code);
  return `${HEADER}${type}${code}${checksum(type, code)}${FOOTER}`;
}

export function buildStartMarker(code) {
  return buildMarker(START_TYPE, code);
}

export function buildEndMarker(code) {
  return buildMarker(END_TYPE, code);
}

export function parseMarker(marker) {
  const pattern = /^##\*#([12])(\d{5})(\d)#\*##$/;
  const match = marker.match(pattern);

  if (!match) {
    throw new Error('Marker has an invalid structure.');
  }

  const [, type, code, receivedChecksum] = match;
  const expectedChecksum = checksum(type, code);

  if (receivedChecksum !== expectedChecksum) {
    throw new Error('Marker checksum failed.');
  }

  return {
    type: type === START_TYPE ? 'start' : 'end',
    code,
    checksum: receivedChecksum,
  };
}
