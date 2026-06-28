/** Session reference pivots for intraday Gann (PDH/PDL, NY session). */

export interface GridCandle {
  time?: string;
  nyTime?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
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
}

function parseNyParts(nyTime: string | undefined): { date: string; hour: number; minute: number } | null {
  if (!nyTime) return null;
  const m = nyTime.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], hour: parseInt(m[2], 10), minute: parseInt(m[3], 10) };
}

/** Previous completed D1 bar + today's NY-session range from M15 nyTime. */
export function computeSessionPivots(d1: GridCandle[], m15: GridCandle[]): SessionPivots | null {
  if (!d1?.length) return null;

  const prev = d1.length >= 2 ? d1[1] : d1[0];
  const pdh = prev.high ?? prev.close;
  const pdl = prev.low ?? prev.close;
  const prevClose = prev.close ?? 0;
  if (pdh == null || pdl == null || prevClose <= 0) return null;

  let nySessionOpen: number | null = null;
  let nySessionHigh: number | null = null;
  let nySessionLow: number | null = null;
  let nySessionStart: string | undefined;

  if (m15?.length) {
    const latestNy = parseNyParts(m15[0].nyTime ?? m15[0].time);
    const sessionDate = latestNy?.date;
    if (sessionDate) {
      const sessionBars = m15.filter(c => {
        const p = parseNyParts(c.nyTime ?? c.time);
        if (!p || p.date !== sessionDate) return false;
        const mins = p.hour * 60 + p.minute;
        return mins >= 8 * 60 && mins <= 17 * 60;
      });
      if (sessionBars.length) {
        const ordered = [...sessionBars].reverse();
        const first = ordered[0];
        nySessionOpen = first.open ?? first.close ?? null;
        nySessionStart = first.nyTime ?? first.time;
        nySessionHigh = Math.max(...sessionBars.map(b => b.high ?? b.close ?? 0));
        nySessionLow = Math.min(...sessionBars.map(b => b.low ?? b.close ?? Infinity));
        if (!Number.isFinite(nySessionLow!)) nySessionLow = null;
      }
    }
  }

  return {
    pdh,
    pdl,
    prevClose,
    prevDayTime: prev.time,
    nySessionOpen,
    nySessionHigh,
    nySessionLow,
    nySessionStart
  };
}

export type SessionPivotKey = 'pdh' | 'pdl' | 'prevClose' | 'nyOpen' | 'nyHigh' | 'nyLow';

export function sessionPivotPrice(pivots: SessionPivots, key: SessionPivotKey): number | null {
  switch (key) {
    case 'pdh': return pivots.pdh;
    case 'pdl': return pivots.pdl;
    case 'prevClose': return pivots.prevClose;
    case 'nyOpen': return pivots.nySessionOpen;
    case 'nyHigh': return pivots.nySessionHigh;
    case 'nyLow': return pivots.nySessionLow;
    default: return null;
  }
}
