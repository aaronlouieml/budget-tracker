import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, FAB, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { personService, type Person } from '../services/personService';
import { ServiceError } from '../services/errors';
import { formatCurrency } from '../utils/format';
import type { PeopleStackParamList } from '../navigation/PeopleNavigator';

type Props = NativeStackScreenProps<PeopleStackParamList, 'PersonList'>;

export default function PeopleScreen({ navigation }: Props) {
  const theme = useTheme();
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    setError(null);
    try {
      const data = await personService.listPeople();
      setPeople(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load people.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
    }, [loadPeople])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
        <Button mode="contained" onPress={loadPeople} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const total = people.reduce((sum, p) => sum + Number(p.outstanding), 0);

  return (
    <View style={styles.container}>
      <FlatList
        data={people}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={people.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={loadPeople}
        ListHeaderComponent={
          people.length > 0 ? (
            <View style={styles.totalRow}>
              <Text variant="titleMedium">Total Owed to You</Text>
              <Text variant="headlineSmall">{formatCurrency(total)}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No one owes you money yet. Tap + to add a person.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => navigation.navigate('PersonDetail', { personId: item.id })}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">{item.name}</Text>
              <Text variant="titleMedium">{formatCurrency(item.outstanding)}</Text>
            </Card.Content>
          </Card>
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('PersonForm', undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
  card: {
    marginBottom: 4,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
