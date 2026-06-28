import { formatWallTime, formatAgeMinutes } from './time.util';

describe('formatWallTime', () => {
  it('formats ISO wall time without timezone shift', () => {
    expect(formatWallTime('2026-06-18T17:30:00')).toBe('Jun 18 17:30');
  });

  it('returns em dash for empty input', () => {
    expect(formatWallTime(null)).toBe('—');
    expect(formatWallTime(undefined)).toBe('—');
  });
});

describe('formatAgeMinutes', () => {
  it('formats sub-hour ages', () => {
    expect(formatAgeMinutes(5)).toBe('5m ago');
  });

  it('formats multi-day ages', () => {
    expect(formatAgeMinutes(36 * 60)).toBe('1d 12h ago');
  });
});
