import { calculateAvailable, calculatePayWhatIOwe, calculateResponsibility } from './financialMath';

describe('calculateResponsibility', () => {
  it('splits a single shared expense into my share and others owe', () => {
    // Section 5/20: ₱2,000 food, split 50/50 with Mau.
    const result = calculateResponsibility([{ amountCents: 200_000, sharesTotalCents: 100_000 }]);
    expect(result.myResponsibilityCents).toBe(100_000);
    expect(result.othersOweCents).toBe(100_000);
  });

  it('treats an expense with no split as entirely my responsibility', () => {
    const result = calculateResponsibility([{ amountCents: 50_000, sharesTotalCents: 0 }]);
    expect(result.myResponsibilityCents).toBe(50_000);
    expect(result.othersOweCents).toBe(0);
  });

  it('sums correctly across multiple shared transactions (spec section 11)', () => {
    const result = calculateResponsibility([
      { amountCents: 200_000, sharesTotalCents: 100_000 }, // T1: 2000 total, Mau owes 1000
      { amountCents: 300_000, sharesTotalCents: 100_000 }, // T2: 3000 total, John owes 1000
      { amountCents: 500_000, sharesTotalCents: 200_000 }, // T3: 5000 total, Mau owes 2000
    ]);
    expect(result.myResponsibilityCents).toBe(600_000); // ₱6,000
    expect(result.othersOweCents).toBe(400_000); // ₱4,000
    expect(result.myResponsibilityCents + result.othersOweCents).toBe(1_000_000); // = total charged, ₱10,000
  });

  it('returns zero for a card with no expenses', () => {
    expect(calculateResponsibility([])).toEqual({ myResponsibilityCents: 0, othersOweCents: 0 });
  });
});

describe('calculatePayWhatIOwe', () => {
  it('suggests exactly my responsibility when it fits within the outstanding balance', () => {
    // Spec section 11: my responsibility 6000, outstanding 10000 -> suggest 6000.
    expect(calculatePayWhatIOwe(600_000, 1_000_000)).toBe(600_000);
  });

  it('never suggests more than what is actually still outstanding', () => {
    // e.g. a prior payment already brought outstanding below my full responsibility.
    expect(calculatePayWhatIOwe(800_000, 300_000)).toBe(300_000);
  });

  it('never suggests a negative amount', () => {
    expect(calculatePayWhatIOwe(-500, 1000)).toBe(0);
  });

  it('suggests zero when the card is already paid off', () => {
    expect(calculatePayWhatIOwe(600_000, 0)).toBe(0);
  });
});

describe('calculateAvailable', () => {
  it('subtracts reserved money from the current balance (spec section 16)', () => {
    expect(calculateAvailable(5_000_000, 2_000_000)).toBe(3_000_000); // 50,000 - 20,000 = 30,000
  });

  it('is unaffected by anything other than balance and reservations', () => {
    expect(calculateAvailable(1000, 0)).toBe(1000);
  });
});
