/** Odd/even Square of Nine bands (matches Python gann_odd_square_util). */

export interface GannOddEvenBlock {
  pivot: number;
  oddSquare: { above: number[]; below: number[] };
  evenSquare: { above: number[]; below: number[] };
}

export function gannOddEvenSquares(pivot: number, bands = 3): GannOddEvenBlock | null {
  if (pivot <= 0) return null;
  const sp = Math.sqrt(pivot);
  const oddAbove: number[] = [];
  const oddBelow: number[] = [];
  const evenAbove: number[] = [];
  const evenBelow: number[] = [];

  for (let i = 1; i <= bands; i++) {
    const step = i * 2;
    const oa = sqrtLevel(sp, step);
    const ob = sqrtLevel(sp, -step);
    const ea = sqrtLevel(sp, step + 1);
    const eb = sqrtLevel(sp, -(step + 1));
    if (oa != null) oddAbove.push(oa);
    if (ob != null) oddBelow.push(ob);
    if (ea != null) evenAbove.push(ea);
    if (eb != null) evenBelow.push(eb);
  }

  return {
    pivot: round5(pivot),
    oddSquare: { above: oddAbove, below: oddBelow },
    evenSquare: { above: evenAbove, below: evenBelow }
  };
}

function sqrtLevel(sp: number, offset: number): number | null {
  const r = sp + offset;
  if (r <= 0) return null;
  return round5(r * r);
}

function round5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

export function isNearAnyLevel(price: number, levels: number[], tolerancePct = 0.08): boolean {
  if (!levels.length || price <= 0) return false;
  const tol = price * (tolerancePct / 100);
  return levels.some(l => Math.abs(l - price) <= Math.max(tol, 0.5));
}
