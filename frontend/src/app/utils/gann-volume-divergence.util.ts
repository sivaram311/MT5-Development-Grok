/** Volume spike & RSI divergence filters for Gann reversal confluence. */

import { GridCandle } from './gann-session-pivot.util';

export function detectVolumeSpike(candles: GridCandle[], lookback = 20, multiplier = 1.5): boolean {
  if (candles.length < lookback + 1) return false;
  const vols = candles.slice(1, lookback + 1).map(c => c.tickVolume ?? c.tick_volume ?? 0);
  const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
  const cur = candles[0].tickVolume ?? candles[0].tick_volume ?? 0;
  return avg > 0 && cur >= avg * multiplier;
}

export function detectRsiDivergence(candles: GridCandle[], lookback = 5): 'bearish' | 'bullish' | null {
  if (candles.length < lookback) return null;
  const sample = candles.slice(0, lookback);
  if (sample.some(c => c.rsi == null)) return null;

  const highs = sample.map(c => c.high ?? c.close ?? 0);
  const lows = sample.map(c => c.low ?? c.close ?? 0);
  const rsis = sample.map(c => c.rsi!);

  if (highs[0] > Math.max(...highs.slice(1)) && rsis[0] < Math.max(...rsis.slice(1))) {
    return 'bearish';
  }
  if (lows[0] < Math.min(...lows.slice(1)) && rsis[0] > Math.min(...rsis.slice(1))) {
    return 'bullish';
  }
  return null;
}
