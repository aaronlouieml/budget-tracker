import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import CategoryIcon from './CategoryIcon';
import AmountText from './AmountText';
import { spacing } from '../theme/spacing';

interface Props {
  category: string;
  title: string;
  subtitle?: string;
  amountText: string;
  amountTone?: 'default' | 'positive' | 'negative' | 'muted';
  onPress?: () => void;
}

// The single row layout for a transaction/expense, shared by the Expenses
// feed and Home's Recent Expenses list so both read as the same product.
export default function TransactionRow({ category, title, subtitle, amountText, amountTone = 'default', onPress }: Props) {
  const theme = useTheme();

  const content = (
    <View style={styles.row}>
      <CategoryIcon category={category} />
      <View style={styles.textGroup}>
        <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" numberOfLines={1} style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <AmountText value={amountText} tone={amountTone} variant="titleSmall" style={styles.amount} />
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableRipple onPress={onPress} style={styles.ripple}>
      {content}
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  ripple: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  textGroup: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  amount: {
    marginLeft: spacing.sm,
  },
});
