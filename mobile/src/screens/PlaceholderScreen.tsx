import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type Props = {
  title: string;
};

export default function PlaceholderScreen({ title }: Props) {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">{title}</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Coming soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.6,
  },
});
