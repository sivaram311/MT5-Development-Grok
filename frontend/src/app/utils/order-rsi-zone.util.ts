/** RSI zone highlight for Order RSI table cells (background box, not text color). */

export type OrderRsiZone = 'red' | 'yellow' | 'green' | 'neutral';

/**
 * Zones:
 * - red:    RSI < 40
 * - yellow: 40–44.9 or 55.1–60
 * - neutral: 45–55
 * - green:  RSI > 60
 */
export function orderRsiZone(rsi: number | null | undefined): OrderRsiZone {
  if (rsi == null || Number.isNaN(rsi)) {
    return 'neutral';
  }
  if (rsi < 40) {
    return 'red';
  }
  if (rsi > 60) {
    return 'green';
  }
  if (rsi < 45 || rsi > 55) {
    return 'yellow';
  }
  return 'neutral';
}

export function orderRsiZoneBoxClass(zone: OrderRsiZone): string {
  switch (zone) {
    case 'red':
      return 'bg-red-950/80 border-red-600/70';
    case 'yellow':
      return 'bg-amber-950/70 border-amber-600/60';
    case 'green':
      return 'bg-emerald-950/80 border-emerald-600/70';
    default:
      return 'bg-zinc-800/80 border-zinc-700';
  }
}
