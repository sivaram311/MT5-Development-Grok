import { formatWallTime } from './time.util';

describe('formatWallTime', () => {
  it('formats ISO wall time without timezone shift', () => {
    expect(formatWallTime('2026-06-18T17:30:00')).toBe('Jun 18 17:30');
  });

  it('returns em dash for empty input', () => {
    expect(formatWallTime(null)).toBe('—');
    expect(formatWallTime(undefined)).toBe('—');
  });
});
