import type { Category } from './expenseOptions';

// Simple keyword -> category rules. First (case-insensitive) substring match wins.
// Intentionally basic per product requirements - no ML/AI here.
const RULES: { keyword: string; category: Category }[] = [
  { keyword: 'jollibee', category: 'Food' },
  { keyword: "mcdonald", category: 'Food' },
  { keyword: 'sm supermarket', category: 'Groceries' },
  { keyword: 'apple', category: 'Gadgets' },
  { keyword: 'netflix', category: 'Entertainment' },
  { keyword: 'grab', category: 'Transportation' },
];

export function suggestCategory(merchant: string | null | undefined): Category | null {
  if (!merchant) return null;
  const normalized = merchant.toLowerCase();
  const match = RULES.find((rule) => normalized.includes(rule.keyword));
  return match?.category ?? null;
}
