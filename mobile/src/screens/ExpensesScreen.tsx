import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Divider, FAB, IconButton, Snackbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { expenseService, type Expense } from '../services/expenseService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { formatCurrency, dateGroupLabel } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import CategoryIcon from '../components/CategoryIcon';
import AmountText from '../components/AmountText';
import EmptyState from '../components/EmptyState';
import { spacing, screenPadding } from '../theme/spacing';
import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseList'>;

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

interface Section {
  title: string;
  data: Expense[];
}

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

  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];
    for (const item of expenses) {
      const label = dateGroupLabel(item.date);
      const last = result[result.length - 1];
      if (last && last.title === label) {
        last.data.push(item);
      } else {
        result.push({ title: label, data: [item] });
      }
    }
    return result;
  }, [expenses]);

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
        <Button mode="contained" onPress={loadExpenses} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={loadExpenses}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="cash-remove"
            title="No expenses yet"
            description="Start tracking your spending to see it appear here."
            actionLabel="Add Expense"
            onActionPress={() => navigation.navigate('ExpenseForm', undefined)}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text variant="labelLarge" style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant, backgroundColor: theme.colors.background }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <View>
            <TouchableRipple onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })} style={styles.rowTouchable}>
              <View style={styles.row}>
                <CategoryIcon category={item.category} />
                <View style={styles.rowText}>
                  <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                    {item.merchant || item.category}
                  </Text>
                  <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.category}
                    {item.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[item.payment_method] ?? item.payment_method) : ''}
                  </Text>
                </View>
                <AmountText value={`-${formatCurrency(item.amount)}`} variant="titleSmall" style={styles.rowAmount} />
                <IconButton icon="delete-outline" size={18} onPress={() => handleDelete(item)} />
              </View>
            </TouchableRipple>
            {index < section.data.length - 1 && <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />}
          </View>
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
    padding: spacing.xl,
  },
  list: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
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
  sectionHeader: {
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
  },
  rowTouchable: {
    marginHorizontal: -screenPadding,
    paddingHorizontal: screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowAmount: {
    marginLeft: spacing.xs,
  },
  divider: {
    marginLeft: 38 + spacing.md,
  },
});
