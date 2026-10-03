import { describe, expect, it } from 'vitest';
import {
  buildEndMarker,
  buildStartMarker,
  checksum,
  parseMarker,
  validateRecordingCode,
} from '../src/protocol.js';

describe('recording code validation', () => {
  it('accepts exactly five digits', () => {
    expect(validateRecordingCode('48231')).toBe('48231');
  });

  it('rejects malformed codes', () => {
    expect(() => validateRecordingCode('1234')).toThrow();
    expect(() => validateRecordingCode('123456')).toThrow();
    expect(() => validateRecordingCode('12A45')).toThrow();
  });
});

describe('marker protocol', () => {
  it('calculates the documented checksums', () => {
    expect(checksum('1', '48231')).toBe('9');
    expect(checksum('2', '48231')).toBe('0');
  });

  it('builds deterministic start and end markers', () => {
    expect(buildStartMarker('48231')).toBe('##*#1482319#*##');
    expect(buildEndMarker('48231')).toBe('##*#2482310#*##');
  });

  it('round-trips valid markers', () => {
    expect(parseMarker(buildStartMarker('65194'))).toEqual({
      type: 'start',
      code: '65194',
      checksum: '6',
    });

    expect(parseMarker(buildEndMarker('65194'))).toEqual({
      type: 'end',
      code: '65194',
      checksum: '7',
    });
  });

  it('rejects a marker damaged in transit', () => {
    expect(() => parseMarker('##*#1482318#*##')).toThrow('checksum');
  });
});
