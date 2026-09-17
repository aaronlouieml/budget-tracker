import type { StyleProp, TextStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { tabularNumberStyle } from '../theme/typography';

type Variant = 'displayLarge' | 'displayMedium' | 'displaySmall' | 'headlineSmall' | 'titleLarge' | 'titleMedium' | 'titleSmall' | 'bodyLarge' | 'bodyMedium' | 'bodySmall';

interface Props {
  value: string;
  variant?: Variant;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
  style?: StyleProp<TextStyle>;
}

// A money figure with consistent tabular-number alignment and tone-based
// color, used wherever an amount is shown so a "positive" green or
// "negative" coral always means the same thing across the app. Callers pass
// the value already formatted (formatCurrency, with any +/- prefix), this
// component only handles color + numeric styling.
export default function AmountText({ value, variant = 'titleMedium', tone = 'default', style }: Props) {
  const theme = useTheme();

  const toneColor = {
    default: theme.colors.onSurface,
    muted: theme.colors.onSurfaceVariant,
    positive: theme.colors.tertiary,
    negative: theme.colors.error,
  }[tone];

  return (
    <Text variant={variant} style={[tabularNumberStyle, { color: toneColor }, style]} numberOfLines={1}>
      {value}
    </Text>
  );
}
