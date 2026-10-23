import { afterEach, describe, expect, it, vi } from 'vitest';
import { remainingDays } from '../src/client/lib/format.js';

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
  vi.useRealTimers();
});

describe('calendar countdown across daylight saving changes', () => {
  it.each([
    ['2030-11-02T16:00:00Z', '2030-11-03', 1],
    ['2030-03-09T17:00:00Z', '2030-03-10', 1],
    ['2030-11-03T17:00:00Z', '2030-11-02', -1],
  ])('counts calendar days from %s to %s', (now, eventDate, expected) => {
    process.env.TZ = 'America/New_York';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    expect(remainingDays(eventDate)).toBe(expected);
  });
});
