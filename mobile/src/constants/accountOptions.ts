import type { AccountType, ReservationPurpose } from '../services/bankAccountService';
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
