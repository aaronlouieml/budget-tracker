import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, FAB, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES } from '../constants/accountOptions';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/cardStatus';
import { formatCurrency, formatShortDate } from '../utils/format';
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

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={load}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No accounts yet. Tap + to add one.
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'account' ? (
            <Card style={styles.card} onPress={() => navigation.navigate('AccountDetail', { accountId: item.data.id })}>
              <Card.Content>
                <View style={styles.headerRow}>
                  <Text variant="titleMedium">{item.data.name}</Text>
                  <View style={styles.typeBadge}>
                    <Text variant="labelSmall" style={styles.typeBadgeText}>
                      {(TYPE_LABELS[item.data.type] ?? item.data.type).toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={styles.detailLabel}>
                      Current
                    </Text>
                    <Text variant="bodyMedium">{formatCurrency(item.data.balance)}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={styles.detailLabel}>
                      Reserved
                    </Text>
                    <Text variant="bodyMedium">{formatCurrency(item.data.reserved)}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={styles.detailLabel}>
                      Available
                    </Text>
                    <Text variant="titleMedium">{formatCurrency(item.data.available)}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ) : (
            <Card style={styles.card} onPress={() => navigation.navigate('CreditCardDetail', { cardId: item.data.id })}>
              <Card.Content>
                <View style={styles.headerRow}>
                  <Text variant="titleMedium">{item.data.name}</Text>
                  <View style={[styles.typeBadge, styles.creditCardBadge]}>
                    <Text variant="labelSmall" style={styles.typeBadgeText}>
                      CREDIT CARD
                    </Text>
                  </View>
                </View>
                <View style={styles.cardStatusRow}>
                  <Text variant="bodySmall" style={styles.detailLabel}>
                    {item.data.bank}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.data.status] }]}>
                    <Text variant="labelSmall" style={styles.statusText}>
                      {STATUS_LABELS[item.data.status]}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={styles.detailLabel}>
                      Outstanding
                    </Text>
                    <Text variant="bodyMedium">{formatCurrency(item.data.unpaid)}</Text>
                  </View>
                  {Number(item.data.othersOwe) > 0 && (
                    <>
                      <View style={styles.detailCol}>
                        <Text variant="bodySmall" style={styles.detailLabel}>
                          My Share
                        </Text>
                        <Text variant="bodyMedium">{formatCurrency(item.data.myResponsibility)}</Text>
                      </View>
                      <View style={styles.detailCol}>
                        <Text variant="bodySmall" style={styles.detailLabel}>
                          Others Owe
                        </Text>
                        <Text variant="bodyMedium">{formatCurrency(item.data.othersOwe)}</Text>
                      </View>
                    </>
                  )}
                  <View style={styles.detailCol}>
                    <Text variant="bodySmall" style={styles.detailLabel}>
                      Due
                    </Text>
                    <Text variant="titleMedium">{formatShortDate(item.data.next_due_date)}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
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
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  creditCardBadge: {
    backgroundColor: 'rgba(103,80,164,0.2)',
  },
  typeBadgeText: {
    opacity: 0.8,
  },
  cardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
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
