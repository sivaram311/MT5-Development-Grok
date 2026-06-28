/** 1×1 Gann angle equilibrium, fan lines & mean-reversion alerts. */

import { GridCandle } from './gann-session-pivot.util';

export type GannAngleBias = 'balanced' | 'overextended_up' | 'overextended_down';

export interface GannFanLine {
  barsAhead: number;
  oneByOne: number;
  twoByOne: number;
  oneByTwo: number;
}

export interface GannAngleStudy {
  pivotPrice: number;
  pivotLabel: string;
  currentPrice: number;
  equilibriumPrice: number;
  deviation: number;
  deviationAtr: number;
  atr: number;
  barsFromOrigin: number;
  oneByOneSlope: number;
  bias: GannAngleBias;
  overextended: boolean;
  angleAlert: boolean;
  extensionThresholdAtr: number;
  fanLines: GannFanLine[];
}

function computeAtr(candles: GridCandle[], period: number): number {
  if (candles.length < period + 1) return 0;
  const chronological = [...candles].reverse();
  let sum = 0;
  for (let i = chronological.length - period; i < chronological.length; i++) {
    const cur = chronological[i];
    const prev = chronological[i - 1];
    const h = cur.high ?? cur.close ?? 0;
    const l = cur.low ?? cur.close ?? 0;
    const pc = prev.close ?? prev.open ?? 0;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    sum += tr;
  }
  return sum / period;
}

export function computeGannOneByOne(
  candles: GridCandle[],
  pivotPrice: number,
  pivotLabel: string,
  originBarIndex: number,
  atrPeriod = 14,
  extensionThresholdAtr = 1.25
): GannAngleStudy | null {
  if (!candles.length || pivotPrice <= 0) return null;

  const current = candles[0];
  const currentPrice = current.close ?? current.open ?? null;
  if (currentPrice == null) return null;

  const atr = computeAtr(candles, atrPeriod);
  const oneByOneSlope = atr > 0 ? atr : pivotPrice * 0.0003;
  const barsFromOrigin = Math.max(0, originBarIndex);
  const equilibriumPrice = pivotPrice + barsFromOrigin * oneByOneSlope;
  const deviation = currentPrice - equilibriumPrice;
  const deviationAtr = atr > 0 ? deviation / atr : 0;

  let bias: GannAngleBias = 'balanced';
  if (deviationAtr >= extensionThresholdAtr) bias = 'overextended_up';
  else if (deviationAtr <= -extensionThresholdAtr) bias = 'overextended_down';

  const fanLines: GannFanLine[] = [];
  for (let n = 0; n < 13; n++) {
    fanLines.push({
      barsAhead: n,
      oneByOne: round2(pivotPrice + (barsFromOrigin + n) * oneByOneSlope),
      twoByOne: round2(pivotPrice + (barsFromOrigin + n) * oneByOneSlope * 2),
      oneByTwo: round2(pivotPrice + (barsFromOrigin + n) * oneByOneSlope * 0.5)
    });
  }

  return {
    pivotPrice,
    pivotLabel,
    currentPrice,
    equilibriumPrice: round2(equilibriumPrice),
    deviation: round2(deviation),
    deviationAtr: round2(deviationAtr),
    atr: round2(atr),
    barsFromOrigin,
    oneByOneSlope: round2(oneByOneSlope),
    bias,
    overextended: bias !== 'balanced',
    angleAlert: Math.abs(deviationAtr) >= extensionThresholdAtr,
    extensionThresholdAtr,
    fanLines
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function findOriginBarIndex(candles: GridCandle[], sessionStartTime?: string): number {
  if (!sessionStartTime || !candles.length) return Math.min(candles.length - 1, 12);
  const idx = candles.findIndex(c => (c.time ?? c.nyTime) === sessionStartTime);
  return idx >= 0 ? idx : Math.min(candles.length - 1, 12);
}
