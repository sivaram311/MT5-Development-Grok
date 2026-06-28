/** NY killzones & intraday reversal confluence alerts. */

import { GannAngleStudy } from './gann-angle.util';
import { TimeSquareStudy } from './gann-time-square.util';
import { GridCandle } from './gann-session-pivot.util';

export interface KillzoneStatus {
  id: string;
  label: string;
  active: boolean;
  window: string;
}

export type ReversalSeverity = 'high' | 'medium' | 'low' | 'none';

export interface ReversalAlert {
  severity: ReversalSeverity;
  active: boolean;
  reasons: string[];
  setup: string;
}

function parseNyMinutes(nyTime: string | undefined): number | null {
  if (!nyTime) return null;
  const m = nyTime.match(/[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function evaluateKillzones(latestNyTime?: string): KillzoneStatus[] {
  const mins = parseNyMinutes(latestNyTime);
  const zones: KillzoneStatus[] = [
    { id: 'ny_open', label: 'NY Open', active: false, window: '08:00–10:00 NY' },
    { id: 'ny_overlap', label: 'NY Overlap', active: false, window: '08:00–11:00 NY' },
    { id: 'ny_close', label: 'NY Afternoon', active: false, window: '14:00–17:00 NY' }
  ];
  if (mins == null) return zones;

  zones[0].active = mins >= 8 * 60 && mins < 10 * 60;
  zones[1].active = mins >= 8 * 60 && mins < 11 * 60;
  zones[2].active = mins >= 14 * 60 && mins <= 17 * 60;
  return zones;
}

function detectReversalCandle(candles: GridCandle[]): boolean {
  if (candles.length < 2) return false;
  const cur = candles[0];
  const prev = candles[1];
  const o0 = cur.open ?? cur.close ?? 0;
  const c0 = cur.close ?? 0;
  const o1 = prev.open ?? prev.close ?? 0;
  const c1 = prev.close ?? 0;
  const body0 = Math.abs(c0 - o0);
  const range0 = (cur.high ?? c0) - (cur.low ?? c0);
  const pin = range0 > 0 && body0 / range0 < 0.35;
  const bullEngulf = c0 > o0 && c1 < o1 && c0 >= o1 && o0 <= c1;
  const bearEngulf = c0 < o0 && c1 > o1 && c0 <= o1 && o0 >= c1;
  return pin || bullEngulf || bearEngulf;
}

export function buildReversalAlert(
  angle: GannAngleStudy | null,
  timeSquare: TimeSquareStudy | null,
  killzones: KillzoneStatus[],
  nearSo9Level: boolean,
  candles: GridCandle[]
): ReversalAlert {
  const reasons: string[] = [];
  let score = 0;

  if (angle?.overextended) {
    reasons.push(`1×1 ${angle.bias === 'overextended_up' ? 'stretched above' : 'stretched below'} (${angle.deviationAtr}× ATR)`);
    score += 2;
  }
  if (nearSo9Level) {
    reasons.push('At Square of Nine level');
    score += 1;
  }
  if (timeSquare?.anyNearSquare) {
    reasons.push('Time squaring milestone');
    score += 1;
  }
  if (killzones.some(z => z.active)) {
    reasons.push(`Killzone: ${killzones.filter(z => z.active).map(z => z.label).join(', ')}`);
    score += 1;
  }
  if (detectReversalCandle(candles)) {
    reasons.push('Reversal candle pattern');
    score += 1;
  }

  let severity: ReversalSeverity = 'none';
  if (score >= 4) severity = 'high';
  else if (score >= 2) severity = 'medium';
  else if (score >= 1) severity = 'low';

  const setup =
    severity === 'high'
      ? 'A+ mean-reversion confluence — confirm entry & use 1×1 as first target'
      : severity === 'medium'
        ? 'Watch for rejection — partial confluence'
        : severity === 'low'
          ? 'Early warning — wait for more alignment'
          : 'No active reversal confluence';

  return {
    severity,
    active: severity !== 'none',
    reasons,
    setup
  };
}
