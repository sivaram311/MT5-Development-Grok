import { computeGannOneByOne, findOriginBarIndex, GannAngleStudy } from './gann-angle.util';
import { buildReversalAlert, evaluateKillzones, KillzoneStatus, ReversalAlert } from './gann-killzone.util';
import {
  computeSessionPivots,
  GridCandle,
  SessionPivotKey,
  SessionPivots,
  sessionPivotPrice
} from './gann-session-pivot.util';
import { buildSo9FineRows, computeSo9FineLevels, So9FineRow } from './gann-so9-fine.util';
import { gannOddEvenSquares, GannOddEvenBlock, isNearAnyLevel } from './gann-so9-odd-even.util';
import { computeTimeSquare, TimeSquareStudy } from './gann-time-square.util';
import { buildGannAboveRows, buildGannBelowRows, GannGridRowDef } from './gann-grid-rows.util';
import { detectRsiDivergence, detectVolumeSpike } from './gann-volume-divergence.util';

export interface GannIntradayFilters {
  volumeSpike: boolean;
  rsiDivergence: 'bearish' | 'bullish' | null | '';
}

export interface GannIntradayStudy {
  live?: boolean;
  entryTf: string;
  currentPrice: number;
  session: SessionPivots;
  so9PivotKey: SessionPivotKey | string;
  so9PivotPrice: number;
  oddEven: GannOddEvenBlock;
  fineAbove: So9FineRow[];
  fineBelow: So9FineRow[];
  oddEvenAboveRows: GannGridRowDef[];
  oddEvenBelowRows: GannGridRowDef[];
  angle: GannAngleStudy;
  timeSquare: TimeSquareStudy | null;
  killzones: KillzoneStatus[];
  filters: GannIntradayFilters;
  reversalAlert: ReversalAlert;
  timeScaleFactor: number;
  extensionThresholdAtr: number;
  updatedAt?: string;
  source?: string;
}

export interface GannIntradayOptions {
  so9PivotKey?: SessionPivotKey;
  timeScaleFactor?: number;
  extensionThresholdAtr?: number;
}

export function computeGannIntradayStudy(
  entryTf: string,
  entryCandles: GridCandle[],
  m15Candles: GridCandle[],
  d1Candles: GridCandle[],
  options: GannIntradayOptions = {}
): GannIntradayStudy | null {
  const so9PivotKey = options.so9PivotKey ?? 'nyOpen';
  const timeScaleFactor = options.timeScaleFactor ?? 1.0;
  const extensionThresholdAtr = options.extensionThresholdAtr ?? 1.25;

  const session = computeSessionPivots(d1Candles, m15Candles);
  if (!session || !entryCandles.length) return null;

  const pivotPrice =
    sessionPivotPrice(session, so9PivotKey as SessionPivotKey) ??
    session.nySessionOpen ??
    session.prevClose;
  if (pivotPrice == null || pivotPrice <= 0) return null;

  const currentPrice = entryCandles[0].close ?? entryCandles[0].open ?? pivotPrice;
  const oddEven = gannOddEvenSquares(pivotPrice);
  if (!oddEven) return null;

  const fineLevels = computeSo9FineLevels(pivotPrice);
  const { above: fineAbove, below: fineBelow } = buildSo9FineRows(fineLevels, pivotPrice);

  const originIdx = findOriginBarIndex(m15Candles, session.nySessionStart);
  const angle = computeGannOneByOne(
    entryCandles,
    pivotPrice,
    labelForPivotKey(so9PivotKey as SessionPivotKey),
    originIdx,
    14,
    extensionThresholdAtr
  );
  if (!angle) return null;

  const timeSquare = computeTimeSquare(
    session.nySessionStart,
    session.nySessionOpen,
    currentPrice,
    timeScaleFactor
  );

  const latest = entryCandles[0];
  const killzones = evaluateKillzones(
    latest.nyTime ?? latest.time,
    latest.istTime
  );
  const allLevels = [
    ...oddEven.oddSquare.above,
    ...oddEven.oddSquare.below,
    ...oddEven.evenSquare.above,
    ...oddEven.evenSquare.below,
    ...fineLevels.map(l => l.price)
  ];
  const nearSo9 = isNearAnyLevel(currentPrice, allLevels);
  const volumeSpike = detectVolumeSpike(entryCandles);
  const rsiDivergence = detectRsiDivergence(entryCandles);
  const reversalAlert = buildReversalAlert(
    angle, timeSquare, killzones, nearSo9, entryCandles, volumeSpike, rsiDivergence
  );

  return {
    entryTf,
    currentPrice,
    session,
    so9PivotKey,
    so9PivotPrice: pivotPrice,
    oddEven,
    fineAbove,
    fineBelow,
    oddEvenAboveRows: buildGannAboveRows(true, true),
    oddEvenBelowRows: buildGannBelowRows(true, true),
    angle,
    timeSquare,
    killzones,
    filters: { volumeSpike, rsiDivergence: rsiDivergence ?? '' },
    reversalAlert,
    timeScaleFactor,
    extensionThresholdAtr
  };
}

function labelForPivotKey(key: SessionPivotKey): string {
  const map: Record<SessionPivotKey, string> = {
    pdh: 'PDH',
    pdl: 'PDL',
    prevClose: 'Prev close',
    nyOpen: 'NY open',
    nyHigh: 'NY high',
    nyLow: 'NY low',
    londonOpen: 'London open',
    londonHigh: 'London high',
    londonLow: 'London low'
  };
  return map[key];
}

export function oddEvenCellValue(
  block: GannOddEvenBlock,
  row: GannGridRowDef
): number | null {
  const bands = row.kind === 'odd' ? block.oddSquare : block.evenSquare;
  return bands[row.direction]?.[row.index] ?? null;
}
