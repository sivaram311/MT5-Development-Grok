export type GannLevelKind = 'support' | 'resistance' | 'pivot';

export interface GannLevel {
  label: string;
  price: number;
  kind: GannLevelKind;
}

export interface GannStudy {
  swingHigh: number;
  swingLow: number;
  pivot: number;
  lastClose: number;
  levels: GannLevel[];
}

interface CandleLike {
  high: number;
  low: number;
  close: number;
  time?: string;
}

/**
 * Lightweight Gann study from recent swing range:
 * - Octave divisions (1/8, 1/2, 7/8)
 * - Square-of-9 levels from pivot (√n ± 0.25 steps)
 */
export function computeGannStudy(candles: CandleLike[], lookback = 60): GannStudy | null {
  if (!candles?.length) {
    return null;
  }

  const sample = candles.slice(0, Math.min(lookback, candles.length));
  let swingHigh = -Infinity;
  let swingLow = Infinity;

  for (const c of sample) {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  }

  if (!Number.isFinite(swingHigh) || !Number.isFinite(swingLow) || swingHigh <= swingLow) {
    return null;
  }

  const range = swingHigh - swingLow;
  const unit = range / 8;
  const pivot = (swingHigh + swingLow) / 2;
  const lastClose = sample[0]?.close ?? pivot;

  const levels: GannLevel[] = [
    { label: 'Swing high (100%)', price: swingHigh, kind: 'resistance' },
    { label: '7/8 resistance', price: swingLow + unit * 7, kind: 'resistance' },
    { label: '3/4 resistance', price: swingLow + unit * 6, kind: 'resistance' },
    { label: '1/2 pivot', price: pivot, kind: 'pivot' },
    { label: '1/4 support', price: swingLow + unit * 2, kind: 'support' },
    { label: '1/8 support', price: swingLow + unit, kind: 'support' },
    { label: 'Swing low (0%)', price: swingLow, kind: 'support' }
  ];

  const sqrtPivot = Math.sqrt(pivot);
  for (let step = -3; step <= 3; step++) {
    if (step === 0) continue;
    const price = Math.pow(sqrtPivot + step * 0.25, 2);
    levels.push({
      label: `Square of 9 ${step > 0 ? '+' : ''}${step}`,
      price,
      kind: step > 0 ? 'resistance' : 'support'
    });
  }

  levels.sort((a, b) => b.price - a.price);

  return { swingHigh, swingLow, pivot, lastClose, levels };
}

export function nearestGannLevels(study: GannStudy, count = 4): GannLevel[] {
  const sorted = [...study.levels].sort(
    (a, b) => Math.abs(a.price - study.lastClose) - Math.abs(b.price - study.lastClose)
  );
  return sorted.slice(0, count);
}
