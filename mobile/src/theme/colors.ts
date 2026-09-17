// Central color palette for the whole app. Screens should never hardcode a
// hex value directly - pull from here (via the Paper theme for MD3 roles,
// or useSemanticColors() for the extra roles MD3 doesn't have) so the app
// reads as one consistent product instead of per-screen color choices.

// MD3-shaped roles, consumed by theme.ts to build the Paper + navigation
// themes. `primary` drives buttons/active states/focus rings (deep navy -
// calm and trustworthy rather than loud); `tertiary` is reserved for
// positive money (available balances, income, success) since that's a
// distinct meaning from "the brand action color".
export const lightColors = {
  primary: '#172033',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E3E7EE',
  onPrimaryContainer: '#172033',
  secondary: '#5B6472',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#EEF0F3',
  onSecondaryContainer: '#2B323D',
  tertiary: '#21B07A',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#DCF4E8',
  onTertiaryContainer: '#0E5A3B',
  error: '#E35D6A',
  onError: '#FFFFFF',
  errorContainer: '#FBE4E6',
  onErrorContainer: '#7C2430',
  background: '#F7F8FA',
  onBackground: '#18202A',
  surface: '#FFFFFF',
  onSurface: '#18202A',
  surfaceVariant: '#F1F3F6',
  onSurfaceVariant: '#6B7280',
  outline: '#E8EBEF',
  outlineVariant: '#EFF1F4',
  inverseSurface: '#18202A',
  inverseOnSurface: '#F7F8FA',
  inversePrimary: '#AEBBD3',
  shadow: '#000000',
  scrim: '#000000',
  backdrop: 'rgba(24, 32, 42, 0.4)',
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
  primary: '#AEBBD3',
  onPrimary: '#101623',
  primaryContainer: '#2B3550',
  onPrimaryContainer: '#E3E7EE',
  secondary: '#AEB6C2',
  onSecondary: '#1B212B',
  secondaryContainer: '#333B47',
  onSecondaryContainer: '#E5E8ED',
  tertiary: '#3FCB94',
  onTertiary: '#08341F',
  tertiaryContainer: '#0E5A3B',
  onTertiaryContainer: '#C7F2DE',
  error: '#F0828D',
  onError: '#450B12',
  errorContainer: '#6E2530',
  onErrorContainer: '#FBE4E6',
  background: '#10141C',
  onBackground: '#EDEFF2',
  surface: '#171C26',
  onSurface: '#EDEFF2',
  surfaceVariant: '#232A36',
  onSurfaceVariant: '#9AA3B2',
  outline: '#333B47',
  outlineVariant: '#262D38',
  inverseSurface: '#EDEFF2',
  inverseOnSurface: '#18202A',
  inversePrimary: '#172033',
  shadow: '#000000',
  scrim: '#000000',
  backdrop: 'rgba(8, 10, 14, 0.55)',
  elevation: {
    level0: 'transparent',
    level1: '#171C26',
    level2: '#1B212C',
    level3: '#1F2632',
    level4: '#212836',
    level5: '#24303F',
  },
};

// Extra semantic roles MD3 doesn't have a native slot for (there is no
// "warning" role). Kept separate from the Paper theme so screens don't need
// module augmentation just to read one extra color - use useSemanticColors().
export const semanticColors = {
  light: {
    warning: '#E9A23B',
    warningContainer: '#FBEBD3',
    onWarningContainer: '#6B4610',
  },
  dark: {
    warning: '#F0B565',
    warningContainer: '#5A3F14',
    onWarningContainer: '#FBEBD3',
  },
};
