import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useSemanticColors } from '../theme/useSemanticColors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';

export type PillTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';

interface Props {
  label: string;
  tone?: PillTone;
}

// One small rounded pill used for every status/type/tag badge in the app
// (account type, credit card status, reservation status) so they all share
// the same shape, sizing, and tone-to-color mapping instead of each screen
// picking its own badge colors.
export default function StatusPill({ label, tone = 'neutral' }: Props) {
  const theme = useTheme();
  const warning = useSemanticColors();

  const toneColors: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceVariant, fg: theme.colors.onSurfaceVariant },
    positive: { bg: theme.colors.tertiaryContainer, fg: theme.colors.onTertiaryContainer },
    negative: { bg: theme.colors.errorContainer, fg: theme.colors.onErrorContainer },
    warning: { bg: warning.warningContainer, fg: warning.onWarningContainer },
    accent: { bg: theme.colors.primaryContainer, fg: theme.colors.onPrimaryContainer },
  };
  const { bg, fg } = toneColors[tone];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="labelSmall" style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    textTransform: 'uppercase',
  },
});
