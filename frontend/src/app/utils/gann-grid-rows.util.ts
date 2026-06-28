/** Row layout helpers for Analyzer Gann grids (So9 odd/even bands around pivot). */

export type GannBandKind = 'odd' | 'even';

export interface GannGridRowDef {
  label: string;
  kind: GannBandKind;
  direction: 'above' | 'below';
  index: number;
  /** Signed √pivot offset — used to sort rows by distance from pivot. */
  sqrtOffset: number;
}

const BANDS = 3;

export function buildGannAboveRows(includeOdd: boolean, includeEven: boolean): GannGridRowDef[] {
  const rows: GannGridRowDef[] = [];
  for (let i = 0; i < BANDS; i++) {
    const n = i + 1;
    if (includeOdd) {
      rows.push({
        label: `OS↑${n}`,
        kind: 'odd',
        direction: 'above',
        index: i,
        sqrtOffset: n * 2
      });
    }
    if (includeEven) {
      rows.push({
        label: `ES↑${n}`,
        kind: 'even',
        direction: 'above',
        index: i,
        sqrtOffset: n * 2 + 1
      });
    }
  }
  // Top of table = furthest / highest above pivot
  return rows.sort((a, b) => b.sqrtOffset - a.sqrtOffset);
}

export function buildGannBelowRows(includeOdd: boolean, includeEven: boolean): GannGridRowDef[] {
  const rows: GannGridRowDef[] = [];
  for (let i = 0; i < BANDS; i++) {
    const n = i + 1;
    if (includeOdd) {
      rows.push({
        label: `OS↓${n}`,
        kind: 'odd',
        direction: 'below',
        index: i,
        sqrtOffset: -(n * 2)
      });
    }
    if (includeEven) {
      rows.push({
        label: `ES↓${n}`,
        kind: 'even',
        direction: 'below',
        index: i,
        sqrtOffset: -(n * 2 + 1)
      });
    }
  }
  // First row under pivot = nearest below (offset closest to zero, e.g. −2 before −3)
  return rows.sort((a, b) => b.sqrtOffset - a.sqrtOffset);
}
