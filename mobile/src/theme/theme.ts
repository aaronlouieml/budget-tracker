import { MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

// Official Material Design 3 baseline colors, adapted for both the
// Paper component library and React Navigation's headers/tab bar so
// colors match everywhere in both light and dark mode.
export const paperLightTheme = MD3LightTheme;
export const paperDarkTheme = MD3DarkTheme;

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
  materialLight: paperLightTheme,
  materialDark: paperDarkTheme,
});

export const navigationLightTheme = LightTheme;
export const navigationDarkTheme = DarkTheme;
