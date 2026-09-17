import { CATEGORY_PASTEL } from './categoryIcons';
import { pastel } from '../theme/colors';

// Reuses the same per-category pastel family as the category icons (see
// categoryIcons.ts) so a category means the same color everywhere it
// appears - here using each family's deeper "fg" tone so chart segments
// stay legible against the light chart background instead of washing out.
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_PASTEL).map(([category, family]) => [category, pastel[family].fg])
);

export function colorForCategory(category: string): string {
  return CATEGORY_COLORS[category] ?? '#77727C';
}
