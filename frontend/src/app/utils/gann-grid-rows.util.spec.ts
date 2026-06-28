import { buildGannAboveRows, buildGannBelowRows } from './gann-grid-rows.util';

describe('gann-grid-rows.util', () => {
  it('merges odd and even above pivot with furthest band at top', () => {
    const rows = buildGannAboveRows(true, true);
    expect(rows.map(r => r.label)).toEqual([
      'ES↑3', 'OS↑3', 'ES↑2', 'OS↑2', 'ES↑1', 'OS↑1'
    ]);
    expect(rows[0].sqrtOffset).toBeGreaterThan(rows[rows.length - 1].sqrtOffset);
  });

  it('orders below pivot nearest-first after pivot row', () => {
    const rows = buildGannBelowRows(true, true);
    expect(rows.map(r => r.label)).toEqual([
      'OS↓1', 'ES↓1', 'OS↓2', 'ES↓2', 'OS↓3', 'ES↓3'
    ]);
  });

  it('supports odd-only rows', () => {
    const above = buildGannAboveRows(true, false);
    expect(above.every(r => r.kind === 'odd')).toBe(true);
    expect(above[0].label).toBe('OS↑3');
  });
});
