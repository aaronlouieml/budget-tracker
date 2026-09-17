import type { MD3Type, MD3TypescaleKey } from 'react-native-paper/lib/typescript/types';

// Overrides applied on top of Paper's default MD3 typescale (configureFonts
// shallow-merges each variant, so fontFamily/letterSpacing we don't set here
// still come from the default). This is the one place that defines the
// app's type hierarchy - every screen already uses `variant="..."` from
// Paper's Text component, so these sizes apply everywhere for free.
//
// Hierarchy (see design spec): large balance 32-36 / screen title 24-28 /
// section title 17-19 / body 15-16 / secondary 13-14. Weights stay at 600
// (semibold) rather than 700 (bold) except for the single largest balance
// display, so the app doesn't read as "everything is bold".
export const fontConfig: Partial<Record<MD3TypescaleKey, Partial<MD3Type>>> = {
  displayLarge: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  displayMedium: { fontSize: 36, lineHeight: 42, fontWeight: '700' },
  displaySmall: { fontSize: 32, lineHeight: 38, fontWeight: '700' },

  headlineLarge: { fontSize: 28, lineHeight: 34, fontWeight: '600' },
  headlineMedium: { fontSize: 26, lineHeight: 32, fontWeight: '600' },
  headlineSmall: { fontSize: 24, lineHeight: 30, fontWeight: '600' },

  titleLarge: { fontSize: 21, lineHeight: 27, fontWeight: '700' },
  titleMedium: { fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: 0 },
  titleSmall: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },

  bodyLarge: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyMedium: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '400' },

  labelLarge: { fontSize: 14, lineHeight: 19, fontWeight: '600', letterSpacing: 0 },
  labelMedium: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  labelSmall: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.3 },
};

// Applies to large numeric displays (the hero balance, snapshot stats) so
// digits line up instead of shifting width per-character. Spread this onto
// a Text style alongside a variant like displaySmall/titleLarge.
export const tabularNumberStyle: { fontVariant: 'tabular-nums'[] } = { fontVariant: ['tabular-nums'] };
