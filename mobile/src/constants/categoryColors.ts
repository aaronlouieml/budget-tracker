import { CATEGORIES } from './expenseOptions';

const PALETTE = [
  '#6750A4',
  '#B5838D',
  '#4CAF9D',
  '#E8A33D',
  '#5C8AE6',
  '#D9534F',
  '#8BC34A',
  '#FF7043',
  '#26A69A',
  '#AB47BC',
  '#789262',
  '#795548',
];

export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((category, index) => [category, PALETTE[index % PALETTE.length]])
);

export function colorForCategory(category: string): string {
  return CATEGORY_COLORS[category] ?? '#9E9E9E';
}
