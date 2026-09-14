import { useTheme } from 'react-native-paper';

// react-native-paper's MD3 theme colors are `rgba(r, g, b, a)` strings, not hex,
// so this reads the r/g/b out of whichever format is passed and applies a new alpha.
function withOpacity(color: string, opacity: number): string {
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// react-native-chart-kit doesn't read the app's theme itself, so this derives
// chart colors (axis labels, legend, gridlines) from Paper's active theme
// instead of hardcoded hex, keeping charts readable in both light and dark mode.
export function useChartTheme() {
  const theme = useTheme();

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => withOpacity(theme.colors.primary, opacity),
    labelColor: (opacity = 1) => withOpacity(theme.colors.onSurfaceVariant, opacity),
    decimalPlaces: 0,
    barPercentage: 0.6,
  };

  return { chartConfig, legendFontColor: theme.colors.onSurfaceVariant };
}
