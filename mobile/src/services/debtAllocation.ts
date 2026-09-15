// Applies a person's total payments against their expense shares oldest-first,
// fully consuming each share before moving to the next. Payments are stored
// only as a person-level total - this is a read-time-only computation used to
// show a per-share "remaining" breakdown, mirroring the oldest-first
// reservation consumption used for credit card payments.
export interface AllocatableShare {
  id: string;
  amountCents: number;
}

export function allocatePayments<T extends AllocatableShare>(sharesOldestFirst: T[], totalPaidCents: number): Map<string, { paidCents: number; remainingCents: number }> {
  const result = new Map<string, { paidCents: number; remainingCents: number }>();
  let remainingPayment = totalPaidCents;

  for (const share of sharesOldestFirst) {
    const paid = Math.min(share.amountCents, Math.max(0, remainingPayment));
    result.set(share.id, { paidCents: paid, remainingCents: Math.max(0, share.amountCents - paid) });
    remainingPayment -= paid;
  }

  return result;
}
