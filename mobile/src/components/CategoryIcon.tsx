import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { iconForCategory } from '../constants/categoryIcons';
import { radii } from '../theme/radii';

interface Props {
  category: string;
  size?: number;
}

// One consistent circular icon treatment for every expense/transaction row,
// rather than a different bright color per category - see categoryIcons.ts.
export default function CategoryIcon({ category, size = 38 }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
    >
      <MaterialCommunityIcons name={iconForCategory(category)} size={size * 0.52} color={theme.colors.onSurfaceVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
