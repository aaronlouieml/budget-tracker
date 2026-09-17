import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Divider, FAB, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { personService, type Person } from '../services/personService';
import { ServiceError } from '../services/errors';
import { formatCurrency } from '../utils/format';
import AmountText from '../components/AmountText';
import EmptyState from '../components/EmptyState';
import { spacing, screenPadding } from '../theme/spacing';
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
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={people}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={people.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={loadPeople}
        ItemSeparatorComponent={() => <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
        ListHeaderComponent={
          people.length > 0 ? (
            <View style={styles.totalBlock}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Total owed to you
              </Text>
              <AmountText value={formatCurrency(total)} variant="displaySmall" tone={total > 0 ? 'positive' : 'default'} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="hand-coin-outline"
            title="No one owes you yet"
            description="Add a person to start tracking shared expenses and repayments."
            actionLabel="Add Person"
            onActionPress={() => navigation.navigate('PersonForm', undefined)}
          />
        }
        renderItem={({ item }) => (
          <TouchableRipple onPress={() => navigation.navigate('PersonDetail', { personId: item.id })} style={styles.rowTouchable}>
            <View style={styles.row}>
              <Avatar.Text size={40} label={item.name.slice(0, 1).toUpperCase()} style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.onPrimaryContainer} />
              <Text variant="bodyLarge" style={[styles.rowName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {item.name}
              </Text>
              <AmountText value={formatCurrency(item.outstanding)} variant="titleSmall" tone={Number(item.outstanding) > 0 ? 'positive' : 'muted'} />
            </View>
          </TouchableRipple>
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
    padding: spacing.xl,
  },
  list: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  totalBlock: {
    marginBottom: spacing.lg,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
  },
  rowTouchable: {
    marginHorizontal: -screenPadding,
    paddingHorizontal: screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  rowName: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.base,
    bottom: spacing.base,
  },
});
