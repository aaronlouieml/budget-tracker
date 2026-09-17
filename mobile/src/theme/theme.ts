import { MD3DarkTheme, MD3LightTheme, adaptNavigationTheme, configureFonts } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

import { darkColors, lightColors } from './colors';
import { fontConfig } from './typography';
import { radii } from './radii';

const fonts = configureFonts({ config: fontConfig });

// The app's own light/dark themes, built from the shared color + type
// tokens instead of Paper's stock Material palette - this is what keeps
// every screen (which just uses Paper components + `variant="..."`)
// visually consistent without per-screen styling.
export const paperLightTheme = {
  ...MD3LightTheme,
  roundness: radii.control,
  colors: { ...MD3LightTheme.colors, ...lightColors },
  fonts,
};

export const paperDarkTheme = {
  ...MD3DarkTheme,
  roundness: radii.control,
  colors: { ...MD3DarkTheme.colors, ...darkColors },
  fonts,
};

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
  materialLight: paperLightTheme,
  materialDark: paperDarkTheme,
});

export const navigationLightTheme = {
  ...LightTheme,
  colors: { ...LightTheme.colors, background: lightColors.background, card: lightColors.surface },
};
export const navigationDarkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: darkColors.background, card: darkColors.surface },
};
