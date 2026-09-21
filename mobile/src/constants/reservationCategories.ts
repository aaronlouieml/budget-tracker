// Suggested categories for Set Aside money - separate from the reservation
// `purpose` enum (which drives credit-card reservation linkage) and from
// expense CATEGORIES (which are about spending, not earmarking). Users can
// also type a custom category; this list is just a starting point.
export const RESERVATION_CATEGORIES = [
  'Bills',
  'Car Loan',
  'Insurance',
  'Travel',
  'Rent',
  'Savings Goal',
  'Subscription',
  'Other',
] as const;
