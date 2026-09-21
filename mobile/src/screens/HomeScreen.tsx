import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Button, Checkbox, Chip, Dialog, Divider, IconButton, Portal, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { formatCurrency, formatDate, dateGroupLabel } from '../utils/format';
import { useChartTheme } from '../hooks/useChartTheme';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import type { RootTabParamList } from '../navigation/AppNavigator';
import SectionHeader from '../components/SectionHeader';
import TransactionRow from '../components/TransactionRow';
import AmountText from '../components/AmountText';
import EmptyState from '../components/EmptyState';
import SliceRing from '../components/SliceRing';
import { spacing, screenPadding } from '../theme/spacing';
import { radii } from '../theme/radii';
import { tabularNumberStyle } from '../theme/typography';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'HomeMain'>, BottomTabScreenProps<RootTabParamList>>;

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

const SECTION_LABELS: Record<HomeSectionKey, string> = {
  accountOverview: 'Account Overview',
  recentExpenses: 'Recent Expenses',
  upcomingDue: 'Upcoming Due Dates',
  reservedMoney: 'Set Aside',
  othersOweMe: 'Others Owe Me',
  monthlySummary: 'Monthly Summary',
  spendingByCategory: 'Spending by Category',
};

const PERIOD_OPTIONS: { value: RecentExpensesPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

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

  const groupedExpenses = useMemo(() => {
    if (!data) return [];
    const groups: { label: string; items: HomeData['recentExpenses'] }[] = [];
    for (const item of data.recentExpenses.slice(0, 8)) {
      const label = dateGroupLabel(item.date);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) {
        lastGroup.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    }
    return groups;
  }, [data]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
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
  // "Your Pocket" is the whole - your slice (available) plus what's set
  // aside (reserved) - both already-computed totals, just summed for
  // display. Credit card debt is a separate liability, not part of the
  // pocket, so it's shown as its own line below.
  const pocketTotal = Number(data.overview.totalAvailable) + Number(data.overview.totalReserved);
  const pieData = data.categoryTotals.map((c) => ({
    name: c.category,
    amount: Number(c.total),
    color: colorForCategory(c.category),
    legendFontColor,
    legendFontSize: 13,
  }));

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
        <View style={styles.greetingRow}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            {greeting()} 👋
          </Text>
          <IconButton icon="tune-variant" size={20} onPress={openCustomize} accessibilityLabel="Customize sections" />
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTopText}>
              <Text variant="labelLarge" style={[styles.heroLabel, styles.heroMuted, { color: theme.colors.onPrimary }]}>
                Your Pocket
              </Text>
              <Text variant="displaySmall" style={[tabularNumberStyle, styles.heroAmount, { color: theme.colors.onPrimary }]}>
                {formatCurrency(pocketTotal)}
              </Text>
            </View>
            <SliceRing
              availableFraction={pocketTotal > 0 ? Number(data.overview.totalAvailable) / pocketTotal : 1}
              availableColor={theme.colors.tertiary}
              setAsideColor="rgba(255, 255, 255, 0.22)"
            />
          </View>
          <View style={[styles.heroDivider, { backgroundColor: theme.colors.onPrimary, opacity: 0.14 }]} />
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <View style={[styles.heroDot, { backgroundColor: theme.colors.tertiary }]} />
              <Text variant="bodySmall" style={[styles.heroStatLabel, styles.heroMuted, { color: theme.colors.onPrimary }]}>
                Your Slice
              </Text>
              <Text variant="titleSmall" style={[tabularNumberStyle, { color: theme.colors.onPrimary }]}>
                {formatCurrency(data.overview.totalAvailable)}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <View style={[styles.heroDot, { backgroundColor: 'rgba(255, 255, 255, 0.5)' }]} />
              <Text variant="bodySmall" style={[styles.heroStatLabel, styles.heroMuted, { color: theme.colors.onPrimary }]}>
                Set Aside
              </Text>
              <Text variant="titleSmall" style={[tabularNumberStyle, { color: theme.colors.onPrimary }]}>
                {formatCurrency(data.overview.totalReserved)}
              </Text>
            </View>
          </View>
          {Number(data.overview.totalCreditCardOutstanding) > 0 && (
            <View style={styles.heroCardsRow}>
              <View style={styles.heroCardsLabelRow}>
                <MaterialCommunityIcons name="credit-card-outline" size={14} color={theme.colors.onPrimary} style={styles.heroMuted} />
                <Text variant="bodySmall" style={[styles.heroMuted, { color: theme.colors.onPrimary }]}>
                  Credit Cards{data.overview.dueSoonCount > 0 ? ` · ${data.overview.dueSoonCount} due soon` : ''}
                </Text>
              </View>
              <Text variant="titleSmall" style={[tabularNumberStyle, { color: theme.colors.onPrimary }]}>
                {formatCurrency(data.overview.totalCreditCardOutstanding)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.quickActionsRow}>
          <QuickAction icon="plus" label="Expense" primary onPress={() => navigation.navigate('Expenses', { screen: 'ExpenseForm', params: undefined })} />
          <QuickAction icon="hand-coin-outline" label="Money Owed" onPress={() => navigation.navigate('Money Owed')} />
          <QuickAction icon="calendar-clock-outline" label="Saved Plans" onPress={() => navigation.navigate('SavedPlans')} />
          <QuickAction icon="rocket-launch-outline" label="Set Me Up" onPress={() => navigation.navigate('Onboarding')} />
        </View>

        {HOME_SECTION_KEYS.filter((key) => visible.has(key)).map((key) => (
          <View key={key} style={styles.section}>
            {key === 'recentExpenses' && (
              <>
                <SectionHeader title="Recent Expenses" actionLabel="See all" onActionPress={() => navigation.navigate('Expenses')} />
                <View style={styles.periodRow}>
                  {PERIOD_OPTIONS.map((p) => (
                    <Chip
                      key={p.value}
                      selected={data.recentExpensesPeriod === p.value}
                      onPress={() => handleChangePeriod(p.value)}
                      mode={data.recentExpensesPeriod === p.value ? 'flat' : 'outlined'}
                      compact
                      style={styles.periodChip}
                    >
                      {p.label}
                    </Chip>
                  ))}
                </View>
                {groupedExpenses.length === 0 ? (
                  <EmptyState icon="cash-remove" title="No expenses yet" description="Start tracking your spending to see it appear here." compact />
                ) : (
                  groupedExpenses.map((group) => (
                    <View key={group.label} style={styles.dayGroup}>
                      <Text variant="labelLarge" style={[styles.dayLabel, { color: theme.colors.onSurfaceVariant }]}>
                        {group.label}
                      </Text>
                      {group.items.map((item, index) => (
                        <View key={item.id}>
                          <TransactionRow
                            category={item.category}
                            title={item.merchant || item.category}
                            subtitle={`${item.category}${item.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[item.payment_method] ?? item.payment_method) : ''}`}
                            amountText={`-${formatCurrency(item.amount)}`}
                          />
                          {index < group.items.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </>
            )}

            {key === 'accountOverview' && (
              <>
                <SectionHeader title="Accounts" actionLabel="See all" onActionPress={() => navigation.navigate('Accounts')} />
                {accounts.length === 0 && cards.length === 0 ? (
                  <EmptyState icon="bank-outline" title="No accounts yet" description="Add a bank account, cash, or e-wallet to get started." compact />
                ) : (
                  <View style={styles.listGroup}>
                    {accounts.map((a, index) => (
                      <View key={a.id}>
                        <View style={styles.accountRow}>
                          <View style={styles.accountRowText}>
                            <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                              {a.name}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              Available
                            </Text>
                          </View>
                          <AmountText value={formatCurrency(a.available)} variant="titleSmall" />
                        </View>
                        {(index < accounts.length - 1 || cards.length > 0) && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                      </View>
                    ))}
                    {cards.map((c, index) => (
                      <View key={c.id}>
                        <View style={styles.accountRow}>
                          <View style={styles.accountRowText}>
                            <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                              {c.name}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              Due {formatDate(c.next_due_date)}
                            </Text>
                          </View>
                          <AmountText value={formatCurrency(c.unpaid)} variant="titleSmall" />
                        </View>
                        {index < cards.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {key === 'upcomingDue' && (
              <>
                <SectionHeader title="Upcoming" subtitle={data.overview.dueSoonCount > 0 ? `${data.overview.dueSoonCount} due soon` : undefined} />
                {data.upcoming.length === 0 ? (
                  <EmptyState icon="calendar-check-outline" title="Nothing due soon" description="Credit card dues and recurring payments will show up here." compact />
                ) : (
                  <View style={styles.listGroup}>
                    {data.upcoming.map((item, index) => (
                      <View key={item.id}>
                        <View style={styles.accountRow}>
                          <View style={styles.accountRowText}>
                            <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                              {item.label}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {item.detail} · {formatDate(item.date)}
                            </Text>
                          </View>
                          <AmountText value={formatCurrency(item.amount)} variant="titleSmall" />
                        </View>
                        {index < data.upcoming.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {key === 'reservedMoney' && (
              <>
                <SectionHeader
                  title="Set Aside"
                  subtitle={data.reservations.length > 0 ? `${formatCurrency(data.overview.totalReserved)} set aside` : 'Save a slice for later.'}
                  actionLabel="Saved Plans"
                  onActionPress={() => navigation.navigate('SavedPlans')}
                />
                {data.reservations.length === 0 ? (
                  <EmptyState icon="lock-outline" title="Nothing set aside" description="Save a slice for rent, bills, or a credit card payment." compact />
                ) : (
                  <View style={styles.listGroup}>
                    {data.reservations.map((r, index) => (
                      <View key={r.id}>
                        <View style={styles.accountRow}>
                          <View style={styles.accountRowText}>
                            <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                              {r.name}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {r.accountName}
                            </Text>
                          </View>
                          <AmountText value={formatCurrency(r.amount)} variant="titleSmall" tone="muted" />
                        </View>
                        {index < data.reservations.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {key === 'othersOweMe' && (
              <>
                <SectionHeader
                  title="Others Owe You"
                  subtitle={data.othersOweMe.people.length > 0 ? `${formatCurrency(data.othersOweMe.total)} owed to you` : 'Nobody owes you right now.'}
                  actionLabel="Money Owed"
                  onActionPress={() => navigation.navigate('Money Owed')}
                />
                {data.othersOweMe.people.length === 0 ? (
                  <EmptyState icon="hand-coin-outline" title="Nobody owes you" description="Split an expense with someone to track what they owe." compact />
                ) : (
                  <View style={styles.listGroup}>
                    {data.othersOweMe.people.map((p, index) => (
                      <View key={p.id}>
                        <View style={styles.accountRow}>
                          <Text variant="bodyLarge" numberOfLines={1} style={[styles.accountRowText, { color: theme.colors.onSurface }]}>
                            {p.name}
                          </Text>
                          <AmountText value={formatCurrency(p.amount)} variant="titleSmall" tone="positive" />
                        </View>
                        {index < data.othersOweMe.people.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {key === 'monthlySummary' && (
              <>
                <SectionHeader title="This Month" />
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Spent
                    </Text>
                    <AmountText value={formatCurrency(data.monthlySummary.spent)} variant="titleMedium" />
                  </View>
                  <View style={styles.summaryCol}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Income
                    </Text>
                    <AmountText value={formatCurrency(data.monthlySummary.income)} variant="titleMedium" tone="positive" />
                  </View>
                  <View style={styles.summaryCol}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Net
                    </Text>
                    <AmountText value={formatCurrency(data.monthlySummary.net)} variant="titleMedium" />
                  </View>
                </View>
              </>
            )}

            {key === 'spendingByCategory' && (
              <>
                <SectionHeader title="Spending" subtitle="This month" />
                {data.categoryTotals.length === 0 ? (
                  <EmptyState icon="chart-donut" title="No spending yet" description="Categorized expenses will appear here this month." compact />
                ) : (
                  <>
                    <PieChart
                      data={pieData}
                      width={screenWidth - screenPadding * 2}
                      height={170}
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
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                              {c.category}
                            </Text>
                          </View>
                          <AmountText value={formatCurrency(c.total)} variant="bodyMedium" tone="muted" />
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
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

function QuickAction({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  const bg = primary ? theme.colors.primary : theme.colors.surface;
  const fg = primary ? theme.colors.onPrimary : theme.colors.onSurface;

  return (
    <TouchableRipple onPress={onPress} style={[styles.quickAction, { backgroundColor: bg, borderColor: theme.colors.outline, borderWidth: primary ? 0 : 1 }]} borderless>
      <View style={styles.quickActionContent}>
        <MaterialCommunityIcons name={icon} size={18} color={fg} />
        <Text variant="labelLarge" style={{ color: fg }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroCard: {
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroTopText: {
    flex: 1,
    paddingRight: spacing.base,
  },
  heroLabel: {
    marginBottom: spacing.xs,
  },
  heroAmount: {
    marginBottom: 0,
  },
  // A muted version of the onPrimary text/icon color, for secondary labels
  // on the hero card - inversePrimary can't be reused here since it's a
  // light tone Paper's own Snackbar relies on staying light for contrast
  // on its dark inverseSurface background.
  heroMuted: {
    opacity: 0.62,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  heroStat: {
    gap: 2,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 3,
  },
  heroStatLabel: {
    marginBottom: 1,
  },
  heroCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroCardsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickAction: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  periodChip: {
    marginRight: 0,
  },
  dayGroup: {
    marginTop: spacing.xs,
  },
  dayLabel: {
    marginBottom: 2,
    marginTop: spacing.sm,
  },
  listGroup: {
    marginTop: spacing.xs,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  accountRowText: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  summaryCol: {
    gap: 2,
  },
  categoryList: {
    marginTop: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
  },
  categoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
  },
});
