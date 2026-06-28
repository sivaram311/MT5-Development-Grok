/** Square of Nine fine steps: 0.25 (45°), 0.5 (90°), 1.0 (180°) on √pivot. */

export interface So9FineLevel {
  label: string;
  price: number;
  stepUnit: number;
  stepCount: number;
  direction: 'above' | 'below';
  angleHint: string;
}

function levelPrice(pivot: number, signedStep: number, unit: number): number | null {
  const root = Math.sqrt(pivot) + signedStep * unit;
  if (root <= 0) return null;
  return Math.round(root * root * 100) / 100;
}

function angleHint(unit: number): string {
  if (unit >= 1) return '180°';
  if (unit >= 0.5) return '90°';
  return '45°';
}

/** Levels for unit 0.25, 0.5, 1.0 — up to 3 steps each direction. */
export function computeSo9FineLevels(pivot: number): So9FineLevel[] {
  if (pivot <= 0) return [];

  const units = [0.25, 0.5, 1.0];
  const levels: So9FineLevel[] = [];

  for (const unit of units) {
    for (let n = 1; n <= 3; n++) {
      const above = levelPrice(pivot, n, unit);
      const below = levelPrice(pivot, -n, unit);
      const hint = angleHint(unit);
      if (above != null) {
        levels.push({
          label: `+${n}×${unit}`,
          price: above,
          stepUnit: unit,
          stepCount: n,
          direction: 'above',
          angleHint: hint
        });
      }
      if (below != null) {
        levels.push({
          label: `−${n}×${unit}`,
          price: below,
          stepUnit: unit,
          stepCount: n,
          direction: 'below',
          angleHint: hint
        });
      }
    }
  }

  return levels.sort((a, b) => b.price - a.price);
}

export interface So9FineRow {
  label: string;
  price: number;
  angleHint: string;
  kind: 'fine';
}

/** Merge above pivot (high→low) and below (near→far) for table display. */
export function buildSo9FineRows(levels: So9FineLevel[], pivot: number): {
  above: So9FineRow[];
  below: So9FineRow[];
} {
  const above = levels
    .filter(l => l.price > pivot)
    .sort((a, b) => b.price - a.price)
    .map(l => ({ label: l.label, price: l.price, angleHint: l.angleHint, kind: 'fine' as const }));
  const below = levels
    .filter(l => l.price < pivot)
    .sort((a, b) => b.price - a.price)
    .map(l => ({ label: l.label, price: l.price, angleHint: l.angleHint, kind: 'fine' as const }));
  return { above, below };
}
