import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { iconForCategory, pastelForCategory } from '../constants/categoryIcons';
import { pastel } from '../theme/colors';
import { radii } from '../theme/radii';

interface Props {
  category: string;
  size?: number;
}

// A pastel-tinted circle behind each category's icon - one consistent
// family per category (see categoryIcons.ts), used as a small accent rather
// than coloring the whole row.
export default function CategoryIcon({ category, size = 38 }: Props) {
  const { bg, fg } = pastel[pastelForCategory(category)];

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: bg,
        },
      ]}
    >
      <MaterialCommunityIcons name={iconForCategory(category)} size={size * 0.52} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
