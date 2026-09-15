import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, FAB, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES } from '../constants/accountOptions';
import { formatCurrency } from '../utils/format';
import type { BankAccountsStackParamList } from '../navigation/BankAccountsNavigator';

type Props = NativeStackScreenProps<BankAccountsStackParamList, 'AccountList'>;

const TYPE_LABELS = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));

export default function BankAccountsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setError(null);
    try {
      const data = await bankAccountService.listAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
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
        <Button mode="contained" onPress={loadAccounts} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={accounts.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={loadAccounts}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No accounts yet. Tap + to add one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => navigation.navigate('AccountDetail', { accountId: item.id })}>
            <Card.Content>
              <View style={styles.headerRow}>
                <Text variant="titleMedium">{item.name}</Text>
                <Text variant="bodySmall" style={styles.type}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailCol}>
                  <Text variant="bodySmall" style={styles.detailLabel}>
                    Current
                  </Text>
                  <Text variant="bodyMedium">{formatCurrency(item.balance)}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text variant="bodySmall" style={styles.detailLabel}>
                    Reserved
                  </Text>
                  <Text variant="bodyMedium">{formatCurrency(item.reserved)}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text variant="bodySmall" style={styles.detailLabel}>
                    Available
                  </Text>
                  <Text variant="titleMedium">{formatCurrency(item.available)}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('AccountForm', undefined)} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    opacity: 0.6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  detailCol: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    opacity: 0.6,
    marginBottom: 2,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
