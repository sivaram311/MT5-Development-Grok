/** Session reference pivots for intraday Gann (PDH/PDL, London/NY session). */

export interface GridCandle {
  time?: string;
  nyTime?: string;
  istTime?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  tickVolume?: number;
  tick_volume?: number;
  rsi?: number;
}

export interface SessionPivots {
  pdh: number;
  pdl: number;
  prevClose: number;
  prevDayTime?: string;
  nySessionOpen: number | null;
  nySessionHigh: number | null;
  nySessionLow: number | null;
  nySessionStart?: string;
  londonSessionOpen: number | null;
  londonSessionHigh: number | null;
  londonSessionLow: number | null;
  londonSessionStart?: string;
}

const NY_START = 8 * 60;
const NY_END = 17 * 60;
const LONDON_START = 3 * 60;
const LONDON_END = 5 * 60;

function parseNyParts(nyTime: string | undefined): { date: string; hour: number; minute: number } | null {
  if (!nyTime) return null;
  const m = nyTime.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], hour: parseInt(m[2], 10), minute: parseInt(m[3], 10) };
}

function applySessionRange(
  bars: GridCandle[],
  prefix: 'ny' | 'london'
): Pick<SessionPivots, 'nySessionOpen' | 'nySessionHigh' | 'nySessionLow' | 'nySessionStart' | 'londonSessionOpen' | 'londonSessionHigh' | 'londonSessionLow' | 'londonSessionStart'> {
  const empty = {
    nySessionOpen: null, nySessionHigh: null, nySessionLow: null, nySessionStart: undefined,
    londonSessionOpen: null, londonSessionHigh: null, londonSessionLow: null, londonSessionStart: undefined
  };
  if (!bars.length) return empty;

  const ordered = [...bars].reverse();
  const first = ordered[0];
  const open = first.open ?? first.close ?? null;
  const start = first.nyTime ?? first.time;
  const high = Math.max(...bars.map(b => b.high ?? b.close ?? 0));
  const low = Math.min(...bars.map(b => b.low ?? b.close ?? Infinity));
  const lowVal = Number.isFinite(low) ? low : null;

  if (prefix === 'ny') {
    return { ...empty, nySessionOpen: open, nySessionHigh: high, nySessionLow: lowVal, nySessionStart: start };
  }
  return { ...empty, londonSessionOpen: open, londonSessionHigh: high, londonSessionLow: lowVal, londonSessionStart: start };
}

/** Previous completed D1 bar + London/NY session ranges from M15 nyTime. */
export function computeSessionPivots(d1: GridCandle[], m15: GridCandle[]): SessionPivots | null {
  if (!d1?.length) return null;

  const prev = d1.length >= 2 ? d1[1] : d1[0];
  const pdh = prev.high ?? prev.close;
  const pdl = prev.low ?? prev.close;
  const prevClose = prev.close ?? 0;
  if (pdh == null || pdl == null || prevClose <= 0) return null;

  let sessionExtras = applySessionRange([], 'ny');

  if (m15?.length) {
    const latestNy = parseNyParts(m15[0].nyTime ?? m15[0].time);
    const sessionDate = latestNy?.date;
    if (sessionDate) {
      const nyBars: GridCandle[] = [];
      const londonBars: GridCandle[] = [];
      for (const c of m15) {
        const p = parseNyParts(c.nyTime ?? c.time);
        if (!p || p.date !== sessionDate) continue;
        const mins = p.hour * 60 + p.minute;
        if (mins >= NY_START && mins <= NY_END) nyBars.push(c);
        if (mins >= LONDON_START && mins < LONDON_END) londonBars.push(c);
      }
      sessionExtras = {
        ...applySessionRange(nyBars, 'ny'),
        ...applySessionRange(londonBars, 'london')
      };
    }
  }

  return {
    pdh,
    pdl,
    prevClose,
    prevDayTime: prev.time,
    nySessionOpen: sessionExtras.nySessionOpen,
    nySessionHigh: sessionExtras.nySessionHigh,
    nySessionLow: sessionExtras.nySessionLow,
    nySessionStart: sessionExtras.nySessionStart,
    londonSessionOpen: sessionExtras.londonSessionOpen,
    londonSessionHigh: sessionExtras.londonSessionHigh,
    londonSessionLow: sessionExtras.londonSessionLow,
    londonSessionStart: sessionExtras.londonSessionStart
  };
}

export type SessionPivotKey =
  | 'pdh' | 'pdl' | 'prevClose'
  | 'nyOpen' | 'nyHigh' | 'nyLow'
  | 'londonOpen' | 'londonHigh' | 'londonLow';

export function sessionPivotPrice(pivots: SessionPivots, key: SessionPivotKey): number | null {
  switch (key) {
    case 'pdh': return pivots.pdh;
    case 'pdl': return pivots.pdl;
    case 'prevClose': return pivots.prevClose;
    case 'nyOpen': return pivots.nySessionOpen;
    case 'nyHigh': return pivots.nySessionHigh;
    case 'nyLow': return pivots.nySessionLow;
    case 'londonOpen': return pivots.londonSessionOpen;
    case 'londonHigh': return pivots.londonSessionHigh;
    case 'londonLow': return pivots.londonSessionLow;
    default: return null;
  }
}
