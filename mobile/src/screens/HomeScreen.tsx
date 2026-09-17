import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Button, Card, Checkbox, Chip, Dialog, Divider, IconButton, List, Portal, Text, useTheme } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import {
  homeService,
  type HomeData,
  type HomeSectionKey,
  type RecentExpensesPeriod,
  HOME_SECTION_KEYS,
} from '../services/homeService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { colorForCategory } from '../constants/categoryColors';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/cardStatus';
import { formatCurrency, formatDate } from '../utils/format';
import { useChartTheme } from '../hooks/useChartTheme';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import type { RootTabParamList } from '../navigation/AppNavigator';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'HomeMain'>, BottomTabScreenProps<RootTabParamList>>;

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

const SECTION_LABELS: Record<HomeSectionKey, string> = {
  accountOverview: 'Account Overview',
  recentExpenses: 'Recent Expenses',
  upcomingDue: 'Upcoming Due Dates',
  reservedMoney: 'Reserved Money',
  monthlySummary: 'Monthly Summary',
  spendingByCategory: 'Spending by Category',
};

const PERIOD_OPTIONS: { value: RecentExpensesPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const { chartConfig, legendFontColor } = useChartTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [data, setData] = useState<HomeData | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCustomizeVisible, setCustomizeVisible] = useState(false);
  const [draftSections, setDraftSections] = useState<HomeSectionKey[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [homeData, accountList, cardList] = await Promise.all([homeService.getHomeData(), bankAccountService.listAccounts(), creditCardService.listCards()]);
      setData(homeData);
      setAccounts(accountList);
      setCards(cardList);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load your overview.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleChangePeriod(period: RecentExpensesPeriod) {
    await homeService.setRecentExpensesPeriod(period);
    await load();
  }

  function openCustomize() {
    setDraftSections(data?.visibleSections ?? []);
    setCustomizeVisible(true);
  }

  function toggleDraftSection(key: HomeSectionKey) {
    setDraftSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSaveCustomize() {
    await homeService.setVisibleSections(draftSections);
    setCustomizeVisible(false);
    await load();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
          {error ?? 'Unable to load your overview.'}
        </Text>
        <Button mode="contained" onPress={load} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const visible = new Set(data.visibleSections);
  const pieData = data.categoryTotals.map((c) => ({
    name: c.category,
    amount: Number(c.total),
    color: colorForCategory(c.category),
    legendFontColor,
    legendFontSize: 13,
  }));

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.snapshotRow}>
          <Card style={styles.snapshotCard}>
            <Card.Content style={styles.snapshotContent}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Available
              </Text>
              <Text variant="titleLarge">{formatCurrency(data.overview.totalAvailable)}</Text>
            </Card.Content>
          </Card>
          <Card style={styles.snapshotCard}>
            <Card.Content style={styles.snapshotContent}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Reserved
              </Text>
              <Text variant="titleLarge">{formatCurrency(data.overview.totalReserved)}</Text>
            </Card.Content>
          </Card>
          <Card style={styles.snapshotCard}>
            <Card.Content style={styles.snapshotContent}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Credit Cards
              </Text>
              <Text variant="titleLarge">{formatCurrency(data.overview.totalCreditCardOutstanding)}</Text>
            </Card.Content>
          </Card>
          <Card style={styles.snapshotCard}>
            <Card.Content style={styles.snapshotContent}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Due Soon
              </Text>
              <Text variant="titleLarge">{data.overview.dueSoonCount}</Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.quickLinksRow}>
          <Button mode="outlined" compact icon="hand-coin-outline" onPress={() => navigation.navigate('Money Owed')} style={styles.quickLinkButton}>
            Money Owed
          </Button>
          <Button mode="outlined" compact icon="calendar-clock-outline" onPress={() => navigation.navigate('SavedPlans')} style={styles.quickLinkButton}>
            Saved Plans
          </Button>
          <Button mode="outlined" compact icon="rocket-launch-outline" onPress={() => navigation.navigate('Onboarding')} style={styles.quickLinkButton}>
            Set Me Up
          </Button>
          <IconButton icon="tune-variant" onPress={openCustomize} accessibilityLabel="Customize sections" />
        </View>

        {HOME_SECTION_KEYS.filter((key) => visible.has(key)).map((key) => (
          <View key={key}>
            {key === 'accountOverview' && (
              <Card style={styles.card}>
                <Card.Title
                  title="Accounts"
                  right={() => (
                    <Button compact onPress={() => navigation.navigate('Accounts')}>
                      See All
                    </Button>
                  )}
                />
                <Card.Content style={styles.noPadding}>
                  {accounts.length === 0 && cards.length === 0 ? (
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      No accounts yet.
                    </Text>
                  ) : (
                    <>
                      {accounts.map((a) => (
                        <List.Item
                          key={a.id}
                          title={a.name}
                          description={`Current ${formatCurrency(a.balance)} · Reserved ${formatCurrency(a.reserved)}`}
                          right={() => (
                            <View style={styles.rowRightStack}>
                              <Text variant="bodySmall" style={styles.mutedLabel}>
                                Available
                              </Text>
                              <Text variant="titleMedium">{formatCurrency(a.available)}</Text>
                            </View>
                          )}
                        />
                      ))}
                      {cards.map((c) => (
                        <List.Item
                          key={c.id}
                          title={c.name}
                          description={`Due ${formatDate(c.next_due_date)}${Number(c.othersOwe) > 0 ? ` · Others Owe ${formatCurrency(c.othersOwe)}` : ''}`}
                          right={() => (
                            <View style={styles.rowRightStack}>
                              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[c.status] }]}>
                                <Text variant="labelSmall" style={styles.statusText}>
                                  {STATUS_LABELS[c.status]}
                                </Text>
                              </View>
                              <Text variant="titleMedium">{formatCurrency(c.unpaid)}</Text>
                            </View>
                          )}
                        />
                      ))}
                    </>
                  )}
                </Card.Content>
              </Card>
            )}

            {key === 'recentExpenses' && (
              <Card style={styles.card}>
                <Card.Title
                  title="Recent Expenses"
                  right={() => (
                    <Button compact onPress={() => navigation.navigate('Expenses')}>
                      See All
                    </Button>
                  )}
                />
                <Card.Content style={styles.noPadding}>
                  <View style={styles.periodRow}>
                    {PERIOD_OPTIONS.map((p) => (
                      <Chip key={p.value} selected={data.recentExpensesPeriod === p.value} onPress={() => handleChangePeriod(p.value)} mode={data.recentExpensesPeriod === p.value ? 'flat' : 'outlined'} compact>
                        {p.label}
                      </Chip>
                    ))}
                  </View>
                  {data.recentExpenses.length === 0 ? (
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      No expenses in this period.
                    </Text>
                  ) : (
                    data.recentExpenses.slice(0, 8).map((item, index) => (
                      <View key={item.id}>
                        <List.Item
                          title={item.category}
                          description={`${item.merchant ? item.merchant + ' · ' : ''}${formatDate(item.date)}${
                            item.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[item.payment_method] ?? item.payment_method) : ''
                          }`}
                          right={() => (
                            <Text variant="titleMedium" style={styles.rowAmount}>
                              {formatCurrency(item.amount)}
                            </Text>
                          )}
                        />
                        {index < Math.min(data.recentExpenses.length, 8) - 1 && <Divider />}
                      </View>
                    ))
                  )}
                </Card.Content>
              </Card>
            )}

            {key === 'upcomingDue' && (
              <Card style={styles.card}>
                <Card.Title title="Upcoming" />
                <Card.Content style={styles.noPadding}>
                  {data.upcoming.length === 0 ? (
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      Nothing due soon.
                    </Text>
                  ) : (
                    data.upcoming.map((item, index) => (
                      <View key={item.id}>
                        <List.Item
                          title={item.label}
                          description={`${item.detail} · ${formatDate(item.date)}`}
                          right={() => (
                            <Text variant="titleMedium" style={styles.rowAmount}>
                              {formatCurrency(item.amount)}
                            </Text>
                          )}
                        />
                        {index < data.upcoming.length - 1 && <Divider />}
                      </View>
                    ))
                  )}
                </Card.Content>
              </Card>
            )}

            {key === 'reservedMoney' && (
              <Card style={styles.card}>
                <Card.Title
                  title="Reserved Money"
                  right={() => (
                    <Button compact onPress={() => navigation.navigate('SavedPlans')}>
                      Saved Plans
                    </Button>
                  )}
                />
                <Card.Content style={styles.noPadding}>
                  {data.reservations.length === 0 ? (
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      No active reservations.
                    </Text>
                  ) : (
                    data.reservations.map((r, index) => (
                      <View key={r.id}>
                        <List.Item
                          title={r.name}
                          description={r.accountName}
                          right={() => (
                            <Text variant="titleMedium" style={styles.rowAmount}>
                              {formatCurrency(r.amount)}
                            </Text>
                          )}
                        />
                        {index < data.reservations.length - 1 && <Divider />}
                      </View>
                    ))
                  )}
                </Card.Content>
              </Card>
            )}

            {key === 'monthlySummary' && (
              <Card style={styles.card}>
                <Card.Title title="This Month" />
                <Card.Content>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCol}>
                      <Text variant="bodySmall" style={styles.mutedLabel}>
                        Spent
                      </Text>
                      <Text variant="titleMedium">{formatCurrency(data.monthlySummary.spent)}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text variant="bodySmall" style={styles.mutedLabel}>
                        Income
                      </Text>
                      <Text variant="titleMedium">{formatCurrency(data.monthlySummary.income)}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text variant="bodySmall" style={styles.mutedLabel}>
                        Net
                      </Text>
                      <Text variant="titleMedium">{formatCurrency(data.monthlySummary.net)}</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}

            {key === 'spendingByCategory' && (
              <Card style={styles.card}>
                <Card.Title title="Spending by Category" subtitle="This month" />
                <Card.Content>
                  {data.categoryTotals.length === 0 ? (
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      No expenses yet this month.
                    </Text>
                  ) : (
                    <>
                      <PieChart
                        data={pieData}
                        width={screenWidth - 64}
                        height={180}
                        accessor="amount"
                        backgroundColor="transparent"
                        paddingLeft="0"
                        chartConfig={chartConfig}
                        hasLegend={false}
                      />
                      <View style={styles.categoryList}>
                        {data.categoryTotals.map((c) => (
                          <View key={c.category} style={styles.categoryRow}>
                            <View style={styles.categoryLabel}>
                              <View style={[styles.swatch, { backgroundColor: colorForCategory(c.category) }]} />
                              <Text variant="bodyMedium">{c.category}</Text>
                            </View>
                            <Text variant="bodyMedium">{formatCurrency(c.total)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}
          </View>
        ))}
      </ScrollView>

      <Portal>
        <Dialog visible={isCustomizeVisible} onDismiss={() => setCustomizeVisible(false)}>
          <Dialog.Title>Customize Home</Dialog.Title>
          <Dialog.Content>
            {HOME_SECTION_KEYS.map((key) => (
              <Checkbox.Item key={key} label={SECTION_LABELS[key]} status={draftSections.includes(key) ? 'checked' : 'unchecked'} onPress={() => toggleDraftSection(key)} />
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCustomizeVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveCustomize}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
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
  snapshotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  snapshotCard: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  snapshotContent: {
    paddingVertical: 8,
  },
  quickLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickLinkButton: {
    marginRight: 0,
  },
  mutedLabel: {
    opacity: 0.6,
  },
  card: {
    marginBottom: 12,
  },
  noPadding: {
    paddingHorizontal: 0,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  rowAmount: {
    alignSelf: 'center',
  },
  rowRightStack: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: '#FFFFFF',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCol: {
    alignItems: 'center',
  },
  categoryList: {
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  categoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
});
