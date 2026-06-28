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

export interface GannIntradayStudy {
  entryTf: string;
  currentPrice: number;
  session: SessionPivots;
  so9PivotKey: SessionPivotKey;
  so9PivotPrice: number;
  oddEven: GannOddEvenBlock;
  fineAbove: So9FineRow[];
  fineBelow: So9FineRow[];
  oddEvenAboveRows: GannGridRowDef[];
  oddEvenBelowRows: GannGridRowDef[];
  angle: GannAngleStudy;
  timeSquare: TimeSquareStudy | null;
  killzones: KillzoneStatus[];
  reversalAlert: ReversalAlert;
}

export function computeGannIntradayStudy(
  entryTf: string,
  entryCandles: GridCandle[],
  m15Candles: GridCandle[],
  d1Candles: GridCandle[],
  so9PivotKey: SessionPivotKey = 'nyOpen'
): GannIntradayStudy | null {
  const session = computeSessionPivots(d1Candles, m15Candles);
  if (!session || !entryCandles.length) return null;

  const pivotPrice =
    sessionPivotPrice(session, so9PivotKey) ??
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
    labelForPivotKey(so9PivotKey),
    originIdx
  );
  if (!angle) return null;

  const timeSquare = computeTimeSquare(
    session.nySessionStart,
    session.nySessionOpen,
    currentPrice
  );

  const killzones = evaluateKillzones(entryCandles[0].nyTime ?? entryCandles[0].time);
  const allLevels = [
    ...oddEven.oddSquare.above,
    ...oddEven.oddSquare.below,
    ...oddEven.evenSquare.above,
    ...oddEven.evenSquare.below,
    ...fineLevels.map(l => l.price)
  ];
  const nearSo9 = isNearAnyLevel(currentPrice, allLevels);
  const reversalAlert = buildReversalAlert(angle, timeSquare, killzones, nearSo9, entryCandles);

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
    reversalAlert
  };
}

function labelForPivotKey(key: SessionPivotKey): string {
  const map: Record<SessionPivotKey, string> = {
    pdh: 'PDH',
    pdl: 'PDL',
    prevClose: 'Prev close',
    nyOpen: 'NY open',
    nyHigh: 'NY high',
    nyLow: 'NY low'
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
