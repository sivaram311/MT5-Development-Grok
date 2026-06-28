import { orderRsiZone, orderRsiZoneBoxClass } from './order-rsi-zone.util';

describe('orderRsiZone', () => {
  it('red below 40', () => {
    expect(orderRsiZone(39)).toBe('red');
  });

  it('yellow 40-44', () => {
    expect(orderRsiZone(42)).toBe('yellow');
  });

  it('neutral 45-55', () => {
    expect(orderRsiZone(50)).toBe('neutral');
  });

  it('yellow 56-60', () => {
    expect(orderRsiZone(58)).toBe('yellow');
  });

  it('green above 60', () => {
    expect(orderRsiZone(65)).toBe('green');
  });

  it('null is neutral', () => {
    expect(orderRsiZone(null)).toBe('neutral');
  });
});

describe('orderRsiZoneBoxClass', () => {
  it('returns border classes per zone', () => {
    expect(orderRsiZoneBoxClass('red')).toContain('red');
    expect(orderRsiZoneBoxClass('green')).toContain('emerald');
  });
});
