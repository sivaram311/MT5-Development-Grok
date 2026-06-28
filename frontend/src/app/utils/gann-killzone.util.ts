/** NY/London killzones, IST windows & intraday reversal confluence alerts. */

import { GannAngleStudy } from './gann-angle.util';
import { TimeSquareStudy } from './gann-time-square.util';
import { GridCandle } from './gann-session-pivot.util';

export interface KillzoneStatus {
  id: string;
  label: string;
  active: boolean;
  window: string;
  istWindow: string;
  istActive?: boolean;
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

function istWindowActive(window: string, istMins: number): boolean {
  const m = window.match(/(\d{2}):(\d{2})–(\d{2}):(\d{2})/);
  if (!m) return false;
  const start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const end = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (end < start) return istMins >= start || istMins <= end;
  return istMins >= start && istMins <= end;
}

export function evaluateKillzones(latestNyTime?: string, latestIstTime?: string): KillzoneStatus[] {
  const mins = parseNyMinutes(latestNyTime);
  const istM = latestIstTime?.match(/[T ](\d{2}):(\d{2})/);
  const istMins = istM ? parseInt(istM[1], 10) * 60 + parseInt(istM[2], 10) : null;

  const zones: KillzoneStatus[] = [
    { id: 'london_open', label: 'London Open', active: false, window: '03:00–05:00 NY', istWindow: '13:30–15:30 IST' },
    { id: 'ny_open', label: 'NY Open', active: false, window: '08:00–10:00 NY', istWindow: '17:30–19:30 IST' },
    { id: 'ny_overlap', label: 'NY Overlap', active: false, window: '08:00–11:00 NY', istWindow: '17:30–20:30 IST' },
    { id: 'ny_close', label: 'NY Afternoon', active: false, window: '14:00–17:00 NY', istWindow: '23:30–02:30 IST' }
  ];
  if (mins == null) return zones;

  zones[0].active = mins >= 3 * 60 && mins < 5 * 60;
  zones[1].active = mins >= 8 * 60 && mins < 10 * 60;
  zones[2].active = mins >= 8 * 60 && mins < 11 * 60;
  zones[3].active = mins >= 14 * 60 && mins <= 17 * 60;

  if (istMins != null) {
    for (const z of zones) {
      z.istActive = istWindowActive(z.istWindow, istMins);
    }
  }
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
  candles: GridCandle[],
  volumeSpike = false,
  rsiDivergence: 'bearish' | 'bullish' | null = null
): ReversalAlert {
  const reasons: string[] = [];
  let score = 0;

  if (angle?.angleAlert) {
    const dir = angle.bias === 'overextended_up' ? 'above' : 'below';
    reasons.push(`1×1 alert — stretched ${dir} (${angle.deviationAtr}× ATR)`);
    score += 2;
  } else if (angle?.overextended) {
    reasons.push(`1×1 ${angle.bias} (${angle.deviationAtr}× ATR)`);
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
  const activeKz = killzones.filter(z => z.active);
  if (activeKz.length) {
    reasons.push(`Killzone: ${activeKz.map(z => z.label).join(', ')}`);
    score += 1;
  }
  if (detectReversalCandle(candles)) {
    reasons.push('Reversal candle pattern');
    score += 1;
  }
  if (volumeSpike) {
    reasons.push('Volume spike vs 20-bar avg');
    score += 1;
  }
  if (rsiDivergence) {
    reasons.push(`RSI ${rsiDivergence} divergence`);
    score += 1;
  }

  let severity: ReversalSeverity = 'none';
  if (score >= 5) severity = 'high';
  else if (score >= 3) severity = 'medium';
  else if (score >= 1) severity = 'low';

  const setup =
    severity === 'high'
      ? 'A+ mean-reversion confluence — confirm entry & use 1×1 as first target'
      : severity === 'medium'
        ? 'Watch for rejection — partial confluence'
        : severity === 'low'
          ? 'Early warning — wait for more alignment'
          : 'No active reversal confluence';

  return { severity, active: severity !== 'none', reasons, setup };
}
