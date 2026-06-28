/** Gann time squaring — session elapsed vs price move with configurable scale. */

export interface TimeSquareMilestone {
  minutes: number;
  label: string;
  scaledMove: number;
  priceTarget: number;
  nearSquare: boolean;
}

export interface TimeSquareStudy {
  sessionStart?: string;
  minutesElapsed: number;
  priceMove: number;
  absPriceMove: number;
  ratioPricePerMin: number;
  scaleFactor: number;
  milestones: TimeSquareMilestone[];
  anyNearSquare: boolean;
}

function parseWallMs(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`);
}

export function computeTimeSquare(
  sessionStartNy: string | undefined,
  sessionOpenPrice: number | null,
  currentPrice: number | null,
  scaleFactor = 1.0,
  nowMs: number = Date.now()
): TimeSquareStudy | null {
  if (sessionOpenPrice == null || currentPrice == null || sessionOpenPrice <= 0) return null;

  const startMs = parseWallMs(sessionStartNy);
  const minutesElapsed = startMs != null
    ? Math.max(0, Math.floor((nowMs - startMs) / 60000))
    : 0;

  const priceMove = currentPrice - sessionOpenPrice;
  const absPriceMove = Math.abs(priceMove);
  const ratioPricePerMin = minutesElapsed > 0 ? absPriceMove / minutesElapsed : 0;

  const checkpoints = [45, 90, 180];
  const milestones: TimeSquareMilestone[] = checkpoints.map(minutes => {
    const scaled = minutes * scaleFactor;
    const priceTarget = sessionOpenPrice + (priceMove >= 0 ? scaled : -scaled);
    const nearTime = Math.abs(minutesElapsed - minutes) <= 5;
    const nearPrice = Math.abs(currentPrice - priceTarget) <= Math.max(2, absPriceMove * 0.05);
    const nearEquality = Math.abs(absPriceMove - scaled) <= Math.max(1.5, scaled * 0.08) && nearTime;
    return {
      minutes,
      label: `${minutes} min`,
      scaledMove: round2(scaled),
      priceTarget: round2(priceTarget),
      nearSquare: nearTime || nearPrice || nearEquality
    };
  });

  const anyNearSquare = milestones.some(m => m.nearSquare)
    || checkpoints.some(m =>
      Math.abs(minutesElapsed - m) <= 3 && Math.abs(absPriceMove - m * scaleFactor) <= 3);

  return {
    sessionStart: sessionStartNy,
    minutesElapsed,
    priceMove: round2(priceMove),
    absPriceMove: round2(absPriceMove),
    ratioPricePerMin: round2(ratioPricePerMin),
    scaleFactor,
    milestones,
    anyNearSquare
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
