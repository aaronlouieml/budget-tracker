import { CATEGORIES } from './expenseOptions';

// A restrained, muted palette (for the spending-by-category chart only -
// transaction rows use one neutral icon treatment, see categoryIcons.ts).
// Kept low-chroma/cohesive rather than a saturated rainbow so the chart
// still reads as "calm" even with many categories.
const PALETTE = [
  '#21B07A',
  '#5B7FD6',
  '#E9A23B',
  '#B08AD9',
  '#4FB8C4',
  '#E38FA0',
  '#7FA6E0',
  '#C99A5B',
  '#6FC29A',
  '#9B8FE0',
  '#5B6472',
  '#D68BAE',
];

export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((category, index) => [category, PALETTE[index % PALETTE.length]])
);

export function colorForCategory(category: string): string {
  return CATEGORY_COLORS[category] ?? '#9E9E9E';
}
