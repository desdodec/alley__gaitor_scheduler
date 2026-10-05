import { describe, expect, it } from 'vitest';
import { bookingDurationMinutes, bookingProgress, createBooking } from '../src/model.js';

const baseBooking = {
  id: 'booking-1',
  reference: 'AG-0001',
  startsAt: '2026-10-05T14:00:00+01:00',
  relationship: 'friends',
  leadName: 'Alex Smith',
  artworkMode: 'individual',
  participants: [
    { id: 'p1', artworkName: 'Alex', recordingCode: '48231', visualisation: 'VIS01' },
    { id: 'p2', artworkName: 'Jo', recordingCode: '65194', visualisation: 'VIS02' },
  ],
};

describe('booking model', () => {
  it('creates a valid booking', () => {
    const booking = createBooking(baseBooking);
    expect(booking.reference).toBe('AG-0001');
    expect(booking.participants).toHaveLength(2);
  });

  it('rejects more than four participants', () => {
    const participants = Array.from({ length: 5 }, (_, index) => ({
      id: `p${index}`,
      artworkName: `Person ${index}`,
      recordingCode: String(10000 + index),
    }));
    expect(() => createBooking({ ...baseBooking, participants })).toThrow('between 1 and 4');
  });

  it('rejects duplicate recording codes', () => {
    expect(() => createBooking({
      ...baseBooking,
      participants: [
        { id: 'p1', artworkName: 'A', recordingCode: '48231' },
        { id: 'p2', artworkName: 'B', recordingCode: '48231' },
      ],
    })).toThrow('unique');
  });

  it('uses editable capacity rules as pure logic', () => {
    expect(bookingDurationMinutes(1)).toBe(5);
    expect(bookingDurationMinutes(3)).toBe(10);
    expect(bookingDurationMinutes(4)).toBe(15);
  });

  it('calculates recording progress independently of booking status', () => {
    const booking = createBooking({
      ...baseBooking,
      participants: [
        { id: 'p1', artworkName: 'A', recordingCode: '48231', recordingState: 'complete' },
        { id: 'p2', artworkName: 'B', recordingCode: '65194', recordingState: 'pending' },
      ],
    });
    expect(bookingProgress(booking)).toEqual({ complete: 1, total: 2, finished: false });
  });
});
