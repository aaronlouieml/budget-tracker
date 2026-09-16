import { toCents, fromCents } from './money';

describe('toCents / fromCents', () => {
  it('round-trips a typical decimal amount', () => {
    expect(toCents('1234.56')).toBe(123_456);
    expect(fromCents(123_456)).toBe('1234.56');
  });

  it('handles whole numbers without a decimal point', () => {
    expect(toCents(50000)).toBe(5_000_000);
    expect(fromCents(5_000_000)).toBe('50000.00');
  });

  it('rounds fractional cents from floating-point input', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point.
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('handles zero', () => {
    expect(toCents(0)).toBe(0);
    expect(fromCents(0)).toBe('0.00');
  });
});
