// One spacing scale for the whole app - screens pick from here instead of
// inventing their own margin/padding numbers, so density stays consistent.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

// Standard horizontal page padding, used by every scrollable screen.
export const screenPadding = spacing.lg;
