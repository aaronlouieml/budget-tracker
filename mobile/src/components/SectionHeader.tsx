import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { spacing } from '../theme/spacing';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

// The one heading style used above every section on Home, Accounts,
// Expenses, etc. - a plain title (optionally with a "See all" action)
// rather than a Card.Title, so sections read as grouped lists instead of
// stacked cards.
export default function SectionHeader({ title, subtitle, actionLabel, onActionPress }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.titleGroup}>
        <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {actionLabel && onActionPress && (
        <TouchableRipple onPress={onActionPress} borderless style={styles.action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {actionLabel}
          </Text>
        </TouchableRipple>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  subtitle: {
    marginTop: 2,
  },
  action: {
    paddingVertical: 2,
  },
});
