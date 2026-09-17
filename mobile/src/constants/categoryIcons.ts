import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category } from './expenseOptions';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// One consistent icon per category, used everywhere a transaction/expense
// row is shown (Expenses feed, Recent Expenses on Home, expense detail).
// Icons sit on a single neutral background rather than a different bright
// color per category - see categoryColors.ts for the one place (the
// spending-by-category chart) that legitimately needs distinct colors.
export const CATEGORY_ICONS: Record<Category, IconName> = {
  Food: 'silverware-fork-knife',
  Groceries: 'basket-outline',
  Rent: 'home-outline',
  Bills: 'receipt',
  Transportation: 'car-outline',
  Shopping: 'shopping-outline',
  Gadgets: 'laptop',
  Entertainment: 'movie-open-outline',
  Health: 'heart-pulse',
  Travel: 'airplane',
  Education: 'school-outline',
  Others: 'dots-horizontal',
};

export function iconForCategory(category: string): IconName {
  return CATEGORY_ICONS[category as Category] ?? 'shape-outline';
}
