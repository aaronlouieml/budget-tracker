import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Divider, IconButton, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { expenseService, type ExpenseDetail } from '../services/expenseService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { formatCurrency, formatDate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import CategoryIcon from '../components/CategoryIcon';
import AmountText from '../components/AmountText';
import StatusPill from '../components/StatusPill';
import { spacing, screenPadding } from '../theme/spacing';
import { tabularNumberStyle } from '../theme/typography';
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
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
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
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <CategoryIcon category={detail.category} size={48} />
        <Text variant="displaySmall" style={[tabularNumberStyle, styles.amount]}>
          {formatCurrency(detail.amount)}
        </Text>
        {detail.merchant && (
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {detail.merchant}
          </Text>
        )}
        <Text variant="bodyMedium" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
          {detail.category} · {formatDate(detail.date)}
          {detail.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[detail.payment_method] ?? detail.payment_method) : ''}
        </Text>
        {detail.source === 'scan' && <StatusPill label="SCANNED" tone="blue" />}
      </View>

      {hasSplit && (
        <>
          <View style={[styles.myShareRow, { borderColor: theme.colors.outlineVariant }]}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              My Share
            </Text>
            <AmountText value={formatCurrency(detail.myShare)} variant="titleMedium" />
          </View>

          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Split With
          </Text>
          {detail.shares.map((share, index) => (
            <View key={share.id}>
              <View style={styles.shareRow}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                  {share.person_name}
                </Text>
                <AmountText value={formatCurrency(share.amount)} variant="titleSmall" />
              </View>
              {index < detail.shares.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.base,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  summary: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  amount: {
    marginTop: spacing.sm,
  },
  mutedLabel: {
    marginBottom: spacing.xs,
  },
  myShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
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
