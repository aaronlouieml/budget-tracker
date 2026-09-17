import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category } from './expenseOptions';
import type { PastelFamily } from '../theme/colors';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// One consistent icon per category, used everywhere a transaction/expense
// row is shown (Expenses feed, Recent Expenses on Home, expense detail).
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

// Each category gets one of the six pastel families, reused consistently
// everywhere a category is shown (icon circles, the spending chart) rather
// than a different color per screen. Each family covers two categories.
export const CATEGORY_PASTEL: Record<Category, PastelFamily> = {
  Food: 'peach',
  Shopping: 'peach',
  Groceries: 'mint',
  Health: 'mint',
  Rent: 'lavender',
  Gadgets: 'lavender',
  Bills: 'yellow',
  Education: 'yellow',
  Transportation: 'blue',
  Travel: 'blue',
  Entertainment: 'pink',
  Others: 'pink',
};

export function pastelForCategory(category: string): PastelFamily {
  return CATEGORY_PASTEL[category as Category] ?? 'lavender';
}
