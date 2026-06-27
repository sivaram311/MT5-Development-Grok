import { computeGannStudy, nearestGannLevels } from './gann.util';

describe('gann.util', () => {
  const candles = [
    { high: 2050, low: 2030, close: 2045 },
    { high: 2048, low: 2025, close: 2035 },
    { high: 2040, low: 2010, close: 2020 }
  ];

  it('computes swing range levels', () => {
    const study = computeGannStudy(candles, 10);
    expect(study).not.toBeNull();
    expect(study!.swingHigh).toBe(2050);
    expect(study!.swingLow).toBe(2010);
    expect(study!.levels.length).toBeGreaterThan(5);
  });

  it('returns nearest levels to last close', () => {
    const study = computeGannStudy(candles, 10)!;
    const nearest = nearestGannLevels(study, 3);
    expect(nearest.length).toBe(3);
  });
});
