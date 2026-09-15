import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Divider, FAB, IconButton, List, Snackbar, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { expenseService, type Expense } from '../services/expenseService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { formatCurrency, formatDate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseList'>;

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export default function ExpensesScreen({ navigation }: Props) {
  const theme = useTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isFabOpen, setFabOpen] = useState(false);

  const loadExpenses = useCallback(async () => {
    setError(null);
    try {
      const data = await expenseService.listExpenses();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load expenses.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses])
  );

  function handleDelete(expense: Expense) {
    confirmDestructive('Delete expense?', `${expense.category} · ${formatCurrency(expense.amount)}`, 'Delete', async () => {
      try {
        await expenseService.deleteExpense(expense.id);
        setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
        setFlash('Expense deleted');
      } catch (err) {
        Alert.alert('Error', err instanceof ServiceError ? err.message : 'Unable to delete expense.');
      }
    });
  }

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
        <Button mode="contained" onPress={loadExpenses} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : undefined}
        refreshing={isLoading}
        onRefresh={loadExpenses}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No expenses yet. Tap + to add one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <List.Item
            title={item.category}
            description={`${item.merchant ? item.merchant + ' · ' : ''}${formatDate(item.date)}${
              item.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[item.payment_method] ?? item.payment_method) : ''
            }`}
            onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
            right={() => (
              <View style={styles.rightContent}>
                <Text variant="titleMedium">{formatCurrency(item.amount)}</Text>
                <IconButton icon="delete-outline" onPress={() => handleDelete(item)} />
              </View>
            )}
          />
        )}
      />

      <FAB.Group
        open={isFabOpen}
        visible
        icon={isFabOpen ? 'close' : 'plus'}
        actions={[
          {
            icon: 'camera',
            label: 'Scan Receipt',
            onPress: () => navigation.navigate('ReceiptCamera'),
          },
          {
            icon: 'pencil-outline',
            label: 'Add Manually',
            onPress: () => navigation.navigate('ExpenseForm', undefined),
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
      />

      <Snackbar visible={!!flash} onDismiss={() => setFlash(null)} duration={2000}>
        {flash}
      </Snackbar>
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
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
