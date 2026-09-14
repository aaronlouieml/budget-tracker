import type { AccountType, ReservationPurpose } from '../api/bankAccounts';

export const ACCOUNT_TYPES: { label: string; value: AccountType }[] = [
  { label: 'Savings', value: 'savings' },
  { label: 'Checking', value: 'checking' },
  { label: 'Cash', value: 'cash' },
  { label: 'E-wallet', value: 'ewallet' },
];

export const RESERVATION_PURPOSES: { label: string; value: ReservationPurpose }[] = [
  { label: 'Credit Card Payment', value: 'credit_card_payment' },
  { label: 'Bill', value: 'bill' },
  { label: 'Other', value: 'other' },
];
