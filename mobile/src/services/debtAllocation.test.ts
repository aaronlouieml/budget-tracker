import { allocatePayments } from './debtAllocation';

describe('allocatePayments', () => {
  it('applies a partial payment against a single share (spec section 12)', () => {
    // Mau owes ₱1,000, pays ₱500 -> owes ₱500.
    const result = allocatePayments([{ id: 'share-1', amountCents: 100_000 }], 50_000);
    expect(result.get('share-1')).toEqual({ paidCents: 50_000, remainingCents: 50_000 });
  });

  it('fully settles a share exactly matched by the payment', () => {
    const result = allocatePayments([{ id: 'share-1', amountCents: 100_000 }], 100_000);
    expect(result.get('share-1')).toEqual({ paidCents: 100_000, remainingCents: 0 });
  });

  it('never lets a share go negative when overpaid', () => {
    const result = allocatePayments([{ id: 'share-1', amountCents: 100_000 }], 150_000);
    expect(result.get('share-1')).toEqual({ paidCents: 100_000, remainingCents: 0 });
  });

  it('consumes shares oldest-first, spilling remaining payment into the next share', () => {
    const shares = [
      { id: 'oldest', amountCents: 100_000 },
      { id: 'newest', amountCents: 200_000 },
    ];
    const result = allocatePayments(shares, 150_000);
    expect(result.get('oldest')).toEqual({ paidCents: 100_000, remainingCents: 0 });
    expect(result.get('newest')).toEqual({ paidCents: 50_000, remainingCents: 150_000 });
  });

  it('leaves every share untouched when nothing has been paid', () => {
    const shares = [
      { id: 'a', amountCents: 100_000 },
      { id: 'b', amountCents: 200_000 },
    ];
    const result = allocatePayments(shares, 0);
    expect(result.get('a')).toEqual({ paidCents: 0, remainingCents: 100_000 });
    expect(result.get('b')).toEqual({ paidCents: 0, remainingCents: 200_000 });
  });
});
