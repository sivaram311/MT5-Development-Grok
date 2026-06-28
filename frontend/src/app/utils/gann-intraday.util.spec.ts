import { computeGannIntradayStudy } from './gann-intraday.util';

describe('gann-intraday.util', () => {
  const d1 = [
    { time: '2026-06-27T00:00:00Z', high: 3350, low: 3320, close: 3340, open: 3335 },
    { time: '2026-06-26T00:00:00Z', high: 3345, low: 3310, close: 3330, open: 3325 }
  ];

  const m15 = [
    { time: '2026-06-28T13:00:00Z', nyTime: '2026-06-28T09:00:00', open: 3342, high: 3348, low: 3340, close: 3346 },
    { time: '2026-06-28T12:45:00Z', nyTime: '2026-06-28T08:45:00', open: 3340, high: 3344, low: 3338, close: 3342 },
    { time: '2026-06-28T12:30:00Z', nyTime: '2026-06-28T08:30:00', open: 3338, high: 3342, low: 3336, close: 3340 },
    { time: '2026-06-28T12:15:00Z', nyTime: '2026-06-28T08:15:00', open: 3336, high: 3340, low: 3334, close: 3338 },
    { time: '2026-06-28T12:00:00Z', nyTime: '2026-06-28T08:00:00', open: 3334, high: 3338, low: 3332, close: 3336 }
  ];

  const m5 = [
    { time: '2026-06-28T13:05:00Z', nyTime: '2026-06-28T09:05:00', open: 3345, high: 3355, low: 3344, close: 3352 },
    { time: '2026-06-28T13:00:00Z', nyTime: '2026-06-28T09:00:00', open: 3342, high: 3348, low: 3340, close: 3345 }
  ];

  it('builds full intraday study from grid candles', () => {
    const study = computeGannIntradayStudy('M5', m5, m15, d1, 'nyOpen');
    expect(study).not.toBeNull();
    expect(study!.so9PivotPrice).toBe(3334);
    expect(study!.oddEven.pivot).toBe(3334);
    expect(study!.fineAbove.length).toBeGreaterThan(0);
    expect(study!.angle.currentPrice).toBe(3352);
    expect(study!.killzones.length).toBe(3);
  });

  it('uses PDH as So9 pivot when selected', () => {
    const study = computeGannIntradayStudy('M5', m5, m15, d1, 'pdh');
    expect(study!.so9PivotPrice).toBe(3345);
  });
});
