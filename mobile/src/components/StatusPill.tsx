import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useSemanticColors } from '../theme/useSemanticColors';
import { pastel, type PastelFamily } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';

export type PillTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent' | PastelFamily;

interface Props {
  label: string;
  tone?: PillTone;
}

const PASTEL_FAMILIES = Object.keys(pastel) as PastelFamily[];

// One small rounded pill used for every status/type/tag badge in the app
// (account type, credit card status, reservation status) so they all share
// the same shape, sizing, and tone-to-color mapping instead of each screen
// picking its own badge colors. Tone can be a semantic role (positive,
// negative, warning...) or one of the six pastel families directly, for
// type badges (e.g. account type) where a specific accent is wanted.
export default function StatusPill({ label, tone = 'neutral' }: Props) {
  const theme = useTheme();
  const warning = useSemanticColors();

  if (PASTEL_FAMILIES.includes(tone as PastelFamily)) {
    const { bg, fg } = pastel[tone as PastelFamily];
    return (
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Text variant="labelSmall" style={[styles.text, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  const toneColors: Record<Exclude<PillTone, PastelFamily>, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceVariant, fg: theme.colors.onSurfaceVariant },
    positive: { bg: theme.colors.tertiaryContainer, fg: theme.colors.onTertiaryContainer },
    negative: { bg: theme.colors.errorContainer, fg: theme.colors.onErrorContainer },
    warning: { bg: warning.warningContainer, fg: warning.onWarningContainer },
    accent: { bg: theme.colors.primaryContainer, fg: theme.colors.onPrimaryContainer },
  };
  const { bg, fg } = toneColors[tone as Exclude<PillTone, PastelFamily>];

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
