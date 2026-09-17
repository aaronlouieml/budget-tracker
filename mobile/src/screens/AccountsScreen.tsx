import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, FAB, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_PASTEL } from '../constants/accountOptions';
import { STATUS_LABELS, STATUS_TONE } from '../constants/cardStatus';
import { formatCurrency, formatShortDate } from '../utils/format';
import StatusPill from '../components/StatusPill';
import AmountText from '../components/AmountText';
import EmptyState from '../components/EmptyState';
import { spacing, screenPadding } from '../theme/spacing';
import { radii } from '../theme/radii';
import type { AccountsStackParamList } from '../navigation/AccountsNavigator';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AccountList'>;

const TYPE_LABELS = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));

type ListItem = { kind: 'account'; data: BankAccount } | { kind: 'card'; data: CreditCard };

export default function AccountsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFabOpen, setFabOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [accountData, cardData] = await Promise.all([bankAccountService.listAccounts(), creditCardService.listCards()]);
      setAccounts(accountData);
      setCards(cardData);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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
        <Button mode="contained" onPress={load} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const items: ListItem[] = [
    ...accounts.map((data) => ({ kind: 'account' as const, data })),
    ...cards.map((data) => ({ kind: 'card' as const, data })),
  ];
  const totalAvailable = accounts.reduce((sum, a) => sum + Number(a.available), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={load}
        ListHeaderComponent={
          items.length > 0 ? (
            <View style={styles.totalBlock}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Total available
              </Text>
              <AmountText value={formatCurrency(totalAvailable)} variant="displaySmall" />
              <Text variant="labelLarge" style={[styles.listLabel, { color: theme.colors.onSurfaceVariant }]}>
                Your accounts
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="bank-outline"
            title="No accounts yet"
            description="Add a bank account, cash, or e-wallet, or a credit card, to start tracking your money."
            actionLabel="Add Account"
            onActionPress={() => navigation.navigate('AccountForm', undefined)}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'account' ? (
            <TouchableRipple
              onPress={() => navigation.navigate('AccountDetail', { accountId: item.data.id })}
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}
              borderless
            >
              <View>
                <View style={styles.headerRow}>
                  <Text variant="titleMedium" numberOfLines={1} style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                    {item.data.name}
                  </Text>
                  <StatusPill label={(TYPE_LABELS[item.data.type] ?? item.data.type).toUpperCase()} tone={ACCOUNT_TYPE_PASTEL[item.data.type] ?? 'neutral'} />
                </View>
                <AmountText value={formatCurrency(item.data.balance)} variant="headlineSmall" style={styles.cardAmount} />
                <View style={styles.detailRow}>
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Available
                    </Text>
                    <AmountText value={formatCurrency(item.data.available)} variant="titleSmall" tone="positive" />
                  </View>
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Set Aside
                    </Text>
                    <AmountText value={formatCurrency(item.data.reserved)} variant="titleSmall" tone="muted" />
                  </View>
                </View>
              </View>
            </TouchableRipple>
          ) : (
            <TouchableRipple
              onPress={() => navigation.navigate('CreditCardDetail', { cardId: item.data.id })}
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}
              borderless
            >
              <View>
                <View style={styles.headerRow}>
                  <Text variant="titleMedium" numberOfLines={1} style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                    {item.data.name}
                  </Text>
                  <StatusPill label="CREDIT CARD" tone="accent" />
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.xs }}>
                  {item.data.bank}
                </Text>
                <AmountText value={formatCurrency(item.data.unpaid)} variant="headlineSmall" style={styles.cardAmount} />
                <Text variant="bodySmall" style={[styles.outstandingLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Outstanding
                </Text>
                <View style={styles.detailRow}>
                  {Number(item.data.othersOwe) > 0 && (
                    <>
                      <View style={styles.detailCol}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          You owe
                        </Text>
                        <AmountText value={formatCurrency(item.data.myResponsibility)} variant="titleSmall" />
                      </View>
                      <View style={styles.detailCol}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          Others owe
                        </Text>
                        <AmountText value={formatCurrency(item.data.othersOwe)} variant="titleSmall" tone="positive" />
                      </View>
                    </>
                  )}
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Due
                    </Text>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                      {formatShortDate(item.data.next_due_date)}
                    </Text>
                  </View>
                  <View style={styles.statusPillWrap}>
                    <StatusPill label={STATUS_LABELS[item.data.status]} tone={STATUS_TONE[item.data.status]} />
                  </View>
                </View>
              </View>
            </TouchableRipple>
          )
        }
      />

      <FAB.Group
        open={isFabOpen}
        visible
        icon={isFabOpen ? 'close' : 'plus'}
        actions={[
          { icon: 'credit-card-outline', label: 'Add Credit Card', onPress: () => navigation.navigate('CreditCardForm', undefined) },
          { icon: 'bank-outline', label: 'Add Account', onPress: () => navigation.navigate('AccountForm', undefined) },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
      />
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
    padding: screenPadding,
    gap: spacing.md,
  },
  totalBlock: {
    marginBottom: spacing.lg,
  },
  listLabel: {
    marginTop: spacing.lg,
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
  card: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardAmount: {
    marginBottom: 2,
  },
  outstandingLabel: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    alignItems: 'flex-end',
  },
  detailCol: {
    gap: 2,
  },
  statusPillWrap: {
    marginLeft: 'auto',
  },
});
