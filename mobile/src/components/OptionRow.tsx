import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { radii } from '../theme/radii';
import { screenPadding, spacing } from '../theme/spacing';

export interface OptionItem {
  key: string;
  label: string;
  sublabel?: string;
  leading?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const GAP = spacing.sm;
// About three tiles fit on screen at once, with the next one peeking in so
// it's obvious the row scrolls.
const VISIBLE_TILES = 3.3;

// A horizontally-scrolling row of large, tappable tiles - used anywhere the
// form asks the user to pick from a short list (category, account, split
// people) so every picker feels the same and stays one tap away.
export default function OptionRow({ items }: { items: OptionItem[] }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const tileWidth = (width - screenPadding * 2 - GAP * (VISIBLE_TILES - 1)) / VISIBLE_TILES;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {items.map((item) => {
        const selected = !!item.selected;
        return (
          <TouchableRipple
            key={item.key}
            onPress={item.onPress}
            disabled={item.disabled}
            borderless
            style={[
              styles.tile,
              {
                width: tileWidth,
                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
                opacity: item.disabled ? 0.45 : 1,
              },
            ]}
          >
            <View style={styles.tileContent}>
              {item.leading}
              <Text
                variant="labelLarge"
                numberOfLines={1}
                style={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface }}
              >
                {item.label}
              </Text>
              {item.sublabel ? (
                <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                  {item.sublabel}
                </Text>
              ) : null}
            </View>
          </TouchableRipple>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleed to the screen edges so tiles scroll under the page padding.
  scroll: {
    marginHorizontal: -screenPadding,
  },
  row: {
    paddingHorizontal: screenPadding,
    gap: GAP,
    paddingVertical: 2,
  },
  tile: {
    borderRadius: radii.card,
    borderWidth: 1.5,
    minHeight: 92,
  },
  tileContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
