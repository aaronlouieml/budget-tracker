// Central color palette for the whole app - the "pastel fintech" direction:
// a warm cream/white base with dark warm-neutral text, and pastel accents
// (lavender, peach, mint, blue, yellow, pink) used deliberately rather than
// flooding every screen. Screens should never hardcode a hex value - pull
// from here (via the Paper theme for MD3 roles, useSemanticColors() for the
// extra "warning" role, or the `pastel` category palette below) so the app
// reads as one consistent product.

// MD3-shaped roles, consumed by theme.ts to build the Paper + navigation
// themes. Paper uses `primary` for far more than button fills - it's also
// the default text/icon/border color for outlined & text buttons, focus
// rings, and selected states. The literal pastel lavender swatch (#C9B6E4)
// only has ~1.9:1 contrast against white, well under readable thresholds,
// so `primary` is a richer lavender-purple instead (still clearly the same
// pastel hue family, paired with white onPrimary text). The paler literal
// swatches live in `pastel` below and in `primaryContainer`, used only for
// badges/fills that pair them with a dark companion text/icon color.
// `tertiary` carries positive money (available balances, income) as a
// readable deep mint, since it's used directly as text color in places.
export const lightColors = {
  primary: '#8B6BC0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EDE4F7',
  onPrimaryContainer: '#5A4080',
  secondary: '#C97A45',
  onSecondary: '#FFFBF8',
  secondaryContainer: '#FFD6BA',
  onSecondaryContainer: '#8A5730',
  tertiary: '#2F8F68',
  onTertiary: '#FFFBF8',
  tertiaryContainer: '#BFE8D4',
  onTertiaryContainer: '#1F6B4A',
  error: '#C2564F',
  onError: '#FFFBF8',
  errorContainer: '#FBE2DE',
  onErrorContainer: '#8A3B34',
  background: '#FFF9F5',
  onBackground: '#34313A',
  surface: '#FFFFFF',
  onSurface: '#34313A',
  surfaceVariant: '#F5F0EC',
  onSurfaceVariant: '#77727C',
  outline: '#EEE8E4',
  outlineVariant: '#F3EEEA',
  inverseSurface: '#34313A',
  inverseOnSurface: '#FFF9F5',
  inversePrimary: '#DCCBF0',
  shadow: '#000000',
  scrim: '#000000',
  backdrop: 'rgba(52, 49, 58, 0.4)',
  elevation: {
    level0: 'transparent',
    level1: '#FFFFFF',
    level2: '#FFFFFF',
    level3: '#FFFFFF',
    level4: '#FFFFFF',
    level5: '#FFFFFF',
  },
};

export const darkColors = {
  primary: '#D9CBEC',
  onPrimary: '#2C2438',
  primaryContainer: '#453A5C',
  onPrimaryContainer: '#E9E0F5',
  secondary: '#F0B285',
  onSecondary: '#3A2412',
  secondaryContainer: '#5C3F22',
  onSecondaryContainer: '#FFDFC4',
  tertiary: '#8FD9B6',
  onTertiary: '#0C3924',
  tertiaryContainer: '#1F6B4A',
  onTertiaryContainer: '#CFF3E2',
  error: '#EDA29C',
  onError: '#4A1512',
  errorContainer: '#6E2F29',
  onErrorContainer: '#FBE2DE',
  background: '#211E28',
  onBackground: '#F2EDF5',
  surface: '#2A2630',
  onSurface: '#F2EDF5',
  surfaceVariant: '#362F3E',
  onSurfaceVariant: '#B2A9BC',
  outline: '#453D4E',
  outlineVariant: '#38313F',
  inverseSurface: '#F2EDF5',
  inverseOnSurface: '#34313A',
  inversePrimary: '#6B4E94',
  shadow: '#000000',
  scrim: '#000000',
  backdrop: 'rgba(15, 13, 18, 0.55)',
  elevation: {
    level0: 'transparent',
    level1: '#2A2630',
    level2: '#2F2A38',
    level3: '#332E3F',
    level4: '#352F42',
    level5: '#392F47',
  },
};

// Extra semantic role MD3 doesn't have a native slot for. Kept separate from
// the Paper theme so screens don't need module augmentation just to read one
// extra color - use useSemanticColors().
export const semanticColors = {
  light: {
    warning: '#A67C1D',
    warningContainer: '#F9E7A8',
    onWarningContainer: '#6B4E10',
  },
  dark: {
    warning: '#F3D989',
    warningContainer: '#5C4A14',
    onWarningContainer: '#FBEFC9',
  },
};

// The six pastel accent families, used for decorative/meaningful color
// coding (category icons, account-type badges, quick actions) - never as
// the base of a whole screen. `bg` is the pastel itself (used directly, e.g.
// as an icon circle's fill); `fg` is a deeper tone of the same hue, dark
// enough to read clearly as an icon glyph or small label drawn on top of it.
export const pastel = {
  lavender: { bg: '#C9B6E4', fg: '#4B3670' },
  peach: { bg: '#FFD6BA', fg: '#8A4B1F' },
  mint: { bg: '#BFE8D4', fg: '#1F6B4A' },
  blue: { bg: '#C8DDF5', fg: '#2F5C8A' },
  yellow: { bg: '#F9E7A8', fg: '#7A5A0F' },
  pink: { bg: '#F5C6D6', fg: '#8A3F5A' },
} as const;

export type PastelFamily = keyof typeof pastel;
