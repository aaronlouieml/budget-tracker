import type { AccountType, ReservationPurpose, IncomingSourceType } from '../services/bankAccountService';
import type { PastelFamily } from '../theme/colors';

export const ACCOUNT_TYPES: { label: string; value: AccountType }[] = [
  { label: 'Savings', value: 'savings' },
  { label: 'Checking', value: 'checking' },
  { label: 'Cash', value: 'cash' },
  { label: 'E-wallet', value: 'ewallet' },
];

// One pastel family per account type, for the type badge - kept separate
// from credit cards, which use the lavender "accent" tone.
export const ACCOUNT_TYPE_PASTEL: Record<AccountType, PastelFamily> = {
  savings: 'mint',
  checking: 'blue',
  cash: 'yellow',
  ewallet: 'pink',
};

export const RESERVATION_PURPOSES: { label: string; value: ReservationPurpose }[] = [
  { label: 'Credit Card Payment', value: 'credit_card_payment' },
  { label: 'Bill', value: 'bill' },
  { label: 'Other', value: 'other' },
];

// How "Coming In" / deposited money is labeled, so the source is clear at a
// glance (e.g. distinct from money that came in via a Money Owed repayment,
// which is its own 'reimbursement' activity type, not one of these).
export const INCOMING_SOURCE_TYPES: { label: string; value: IncomingSourceType }[] = [
  { label: 'Salary', value: 'salary' },
  { label: 'Refund', value: 'refund' },
  { label: 'Gift', value: 'gift' },
  { label: 'Other', value: 'other' },
  { label: 'Manual', value: 'manual' },
];
