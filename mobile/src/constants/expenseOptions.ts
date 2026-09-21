export const CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Bills',
  'Transportation',
  'Shopping',
  'Gadgets',
  'Entertainment',
  'Health',
  'Travel',
  'Education',
  'Others',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS: { label: string; value: string }[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Debit Card', value: 'debit_card' },
  { label: 'E-wallet', value: 'ewallet' },
  { label: 'Credit Card', value: 'credit_card' },
];
