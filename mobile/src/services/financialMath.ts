// Pure, dependency-free money calculations shared by the credit-card and
// transfer services. Kept separate from SQL/repository code specifically so
// the financial logic itself can be unit tested without a database.

// For each of a card's expenses, "my share" is the expense amount minus
// whatever was split out to other people. Summed across all the card's
// expenses this is the card-level responsibility split - independent of
// payment history (payments only reduce the card's overall outstanding).
export function calculateResponsibility(expenses: { amountCents: number; sharesTotalCents: number }[]): {
  myResponsibilityCents: number;
  othersOweCents: number;
} {
  let myResponsibilityCents = 0;
  let othersOweCents = 0;
  for (const e of expenses) {
    othersOweCents += e.sharesTotalCents;
    myResponsibilityCents += e.amountCents - e.sharesTotalCents;
  }
  return { myResponsibilityCents, othersOweCents };
}

// "Pay What I Owe" can never suggest more than what's actually still
// outstanding on the card (e.g. if prior payments already covered part of
// it), and never a negative amount.
export function calculatePayWhatIOwe(myResponsibilityCents: number, outstandingCents: number): number {
  return Math.max(0, Math.min(myResponsibilityCents, outstandingCents));
}

export function calculateAvailable(balanceCents: number, reservedCents: number): number {
  return balanceCents - reservedCents;
}
