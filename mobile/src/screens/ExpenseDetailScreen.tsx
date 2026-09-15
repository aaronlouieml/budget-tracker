import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Divider, IconButton, List, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { expenseService, type ExpenseDetail } from '../services/expenseService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { formatCurrency, formatDate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseDetail'>;

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export default function ExpenseDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { expenseId } = route.params;

  const [detail, setDetail] = useState<ExpenseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setError(null);
    try {
      const data = await expenseService.fetchExpense(expenseId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load expense.');
    } finally {
      setIsLoading(false);
    }
  }, [expenseId]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail])
  );

  function handleDelete() {
    if (!detail) return;
    confirmDestructive('Delete expense?', `${detail.category} · ${formatCurrency(detail.amount)}`, 'Delete', async () => {
      try {
        await expenseService.deleteExpense(expenseId);
        navigation.goBack();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to delete expense.');
      }
    });
  }

  useEffect(() => {
    if (!detail) return;
    navigation.setOptions({
      title: detail.category,
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton icon="pencil-outline" onPress={() => navigation.navigate('ExpenseForm', { expense: detail })} />
          <IconButton icon="delete-outline" onPress={handleDelete} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
          {error ?? 'Unable to load expense.'}
        </Text>
        <Button mode="contained" onPress={loadDetail} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const hasSplit = detail.shares.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text variant="displaySmall">{formatCurrency(detail.amount)}</Text>
        <Text variant="bodyMedium" style={styles.mutedLabel}>
          Total
        </Text>
        {detail.merchant && <Text variant="titleMedium">{detail.merchant}</Text>}
        <Text variant="bodyMedium" style={styles.mutedLabel}>
          {formatDate(detail.date)}
          {detail.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[detail.payment_method] ?? detail.payment_method) : ''}
        </Text>
      </View>

      {hasSplit && (
        <>
          <View style={styles.myShareRow}>
            <Text variant="bodyMedium">My Share</Text>
            <Text variant="titleMedium">{formatCurrency(detail.myShare)}</Text>
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Split With
          </Text>
          {detail.shares.map((share, index) => (
            <View key={share.id}>
              <List.Item title={share.person_name} right={() => <Text variant="titleMedium">{formatCurrency(share.amount)}</Text>} />
              {index < detail.shares.length - 1 && <Divider />}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  summary: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mutedLabel: {
    opacity: 0.6,
    marginBottom: 4,
  },
  myShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
});
