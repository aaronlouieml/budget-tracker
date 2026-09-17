import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  IconButton,
  Menu,
  Portal,
  RadioButton,
  Text,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { creditCardService, type CreditCardDetail, type PaySource } from '../services/creditCardService';
import { bankAccountService, type BankAccount, type BankAccountDetail } from '../services/bankAccountService';
import { recurringPaymentService, type RecurringPayment } from '../services/recurringPaymentService';
import { ServiceError } from '../services/errors';
import { STATUS_LABELS, STATUS_TONE } from '../constants/cardStatus';
import { formatCurrency, formatDate, todayISODate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import AppTextInput from '../components/AppTextInput';
import StatusPill from '../components/StatusPill';
import AmountText from '../components/AmountText';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import { spacing, screenPadding } from '../theme/spacing';
import { radii } from '../theme/radii';
import { tabularNumberStyle } from '../theme/typography';
import type { AccountsStackParamList } from '../navigation/AccountsNavigator';
import type { RootTabParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<AccountsStackParamList, 'CreditCardDetail'>;

export default function CreditCardDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { cardId } = route.params;

  const [detail, setDetail] = useState<CreditCardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [isPayDialogVisible, setPayDialogVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [payAccountDetail, setPayAccountDetail] = useState<BankAccountDetail | null>(null);
  const [isLoadingPayAccount, setIsLoadingPayAccount] = useState(false);
  const [paySource, setPaySource] = useState<PaySource>('available');
  const [payReservationId, setPayReservationId] = useState<string | null>(null);
  const [isAccountMenuVisible, setAccountMenuVisible] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadDetail = useCallback(async () => {
    setError(null);
    try {
      const data = await creditCardService.fetchCard(cardId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load credit card.');
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
      bankAccountService
        .listAccounts()
        .then(setAccounts)
        .catch(() => {
          // Non-critical: the "Pay from Account" picker just falls back to "no accounts" state.
        });
      recurringPaymentService
        .listForCard(cardId)
        .then(setRecurring)
        .catch(() => {
          // Non-critical: the summary section just shows nothing until the next focus.
        });
    }, [loadDetail, cardId])
  );

  const activeRecurring = recurring.filter((r) => r.is_active);
  const monthlyEquivalentTotal = activeRecurring.reduce((sum, r) => {
    const amount = Number(r.amount);
    if (r.frequency === 'weekly') return sum + (amount * 52) / 12;
    if (r.frequency === 'yearly') return sum + amount / 12;
    return sum + amount;
  }, 0);
  const nextRecurring = activeRecurring.slice().sort((a, b) => a.next_date.localeCompare(b.next_date))[0] ?? null;

  function handleDelete() {
    if (!detail) return;
    confirmDestructive('Delete card?', `${detail.card.name} will be removed. Its expenses will be kept.`, 'Delete', async () => {
      try {
        await creditCardService.deleteCard(cardId);
        navigation.goBack();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to delete credit card.');
      }
    });
  }

  useEffect(() => {
    if (!detail) return;
    navigation.setOptions({
      title: detail.card.name,
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton icon="pencil-outline" onPress={() => navigation.navigate('CreditCardForm', { card: detail.card })} />
          <IconButton icon="delete-outline" onPress={handleDelete} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  function openPayDialog() {
    setPayAmount(detail ? detail.card.unpaid : '');
    setPayAccountId(null);
    setPayAccountDetail(null);
    setPaySource('available');
    setPayReservationId(null);
    setPayError(null);
    setPayDialogVisible(true);
  }

  async function selectPayAccount(account: BankAccount) {
    setPayAccountId(account.id);
    setAccountMenuVisible(false);
    setPaySource('available');
    setPayReservationId(null);
    setPayError(null);
    setIsLoadingPayAccount(true);
    try {
      const fullDetail = await bankAccountService.fetchAccount(account.id);
      setPayAccountDetail(fullDetail);
    } catch (err) {
      setPayError(err instanceof ServiceError ? err.message : 'Unable to load account details.');
    } finally {
      setIsLoadingPayAccount(false);
    }
  }

  async function handlePayFromAccount() {
    const amountValue = Number(payAmount);
    if (!payAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setPayError('Enter a valid amount');
      return;
    }
    if (payAccountId === null) {
      setPayError('Select an account to pay from');
      return;
    }
    if (paySource === 'reservation' && payReservationId === null) {
      setPayError('Select a reservation to pay from');
      return;
    }

    setIsSubmittingPay(true);
    setPayError(null);
    try {
      await creditCardService.payFromAccount(cardId, {
        bankAccountId: payAccountId,
        amount: amountValue,
        source: paySource,
        reservationId: paySource === 'reservation' && payReservationId !== null ? payReservationId : undefined,
        date: todayISODate(),
      });
      setPayDialogVisible(false);
      await loadDetail();
    } catch (err) {
      setPayError(err instanceof ServiceError ? err.message : 'Unable to pay from account.');
    } finally {
      setIsSubmittingPay(false);
    }
  }

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
          {error ?? 'Unable to load credit card.'}
        </Text>
        <Button mode="contained" onPress={loadDetail} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const { card, transactions, payments } = detail;
  const selectedAccount = accounts.find((a) => a.id === payAccountId);
  const hasSharedResponsibility = Number(card.othersOwe) > 0;

  return (
    <>
      <DismissKeyboardView>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
        <View style={[styles.summary, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text variant="bodyMedium" style={[styles.bank, { color: theme.colors.inversePrimary }]}>
                {card.bank}
              </Text>
              <StatusPill label="CREDIT CARD" tone="neutral" />
            </View>
            <StatusPill label={STATUS_LABELS[card.status]} tone={STATUS_TONE[card.status]} />
          </View>

          <Text variant="displaySmall" style={[tabularNumberStyle, styles.unpaidAmount, { color: theme.colors.onPrimary }]}>
            {formatCurrency(card.unpaid)}
          </Text>
          <Text variant="bodyMedium" style={[styles.unpaidLabel, { color: theme.colors.inversePrimary }]}>
            Outstanding
          </Text>

          {hasSharedResponsibility && (
            <>
              <View style={[styles.summaryDivider, { backgroundColor: theme.colors.onPrimary }]} />
              <View style={styles.responsibilityRow}>
                <View>
                  <Text variant="bodySmall" style={{ color: theme.colors.inversePrimary }}>
                    You owe
                  </Text>
                  <Text variant="titleMedium" style={[tabularNumberStyle, { color: theme.colors.onPrimary }]}>
                    {formatCurrency(card.myResponsibility)}
                  </Text>
                </View>
                <View style={styles.responsibilityRight}>
                  <Text variant="bodySmall" style={{ color: theme.colors.inversePrimary }}>
                    Others owe you
                  </Text>
                  <Text variant="titleMedium" style={[tabularNumberStyle, { color: theme.colors.onPrimary }]}>
                    {formatCurrency(card.othersOwe)}
                  </Text>
                </View>
              </View>
            </>
          )}

          <Text variant="bodyMedium" style={[styles.dueText, { color: theme.colors.inversePrimary }]}>
            Due {formatDate(card.next_due_date)}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={openPayDialog} style={styles.payButton} contentStyle={styles.payButtonContent} icon="bank-transfer-out">
            Pay Card
          </Button>
          {hasSharedResponsibility && (
            <Button
              mode="outlined"
              onPress={() => navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('Money Owed')}
              style={styles.secondaryButton}
              icon="hand-coin-outline"
            >
              Money Owed
            </Button>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Transactions" />
          {transactions.length === 0 ? (
            <EmptyState icon="credit-card-outline" title="No transactions yet" description="Expenses charged to this card will show up here." compact />
          ) : (
            transactions.map((item, index) => (
              <View key={item.id}>
                <View style={styles.listRow}>
                  <View style={styles.listRowText}>
                    <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                      {item.merchant || item.category}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={2}>
                      {item.category} · {formatDate(item.date)}
                      {Number(item.othersOwe) > 0 ? ` · You ${formatCurrency(item.myShare)}` : ''}
                    </Text>
                  </View>
                  <AmountText value={`-${formatCurrency(item.amount)}`} variant="titleSmall" />
                </View>
                {index < transactions.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Payments" />
          {payments.length === 0 ? (
            <EmptyState icon="check-circle-outline" title="No payments yet" description="Payments toward this card will show up here." compact />
          ) : (
            payments.map((item, index) => (
              <View key={item.id}>
                <View style={styles.listRow}>
                  <View style={styles.listRowText}>
                    <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                      Payment
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.bank_account_name ? `From ${item.bank_account_name} · ` : ''}
                      {formatDate(item.date)}
                    </Text>
                  </View>
                  <AmountText value={formatCurrency(item.amount)} variant="titleSmall" tone="positive" />
                </View>
                {index < payments.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recurring Payments" actionLabel="Manage" onActionPress={() => navigation.navigate('RecurringPayments', { cardId, cardName: card.name })} />
          {activeRecurring.length === 0 ? (
            <EmptyState icon="calendar-sync-outline" title="No recurring payments" description="Add subscriptions or bills charged to this card." compact />
          ) : (
            <View style={styles.recurringSummary}>
              <View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Total monthly
                </Text>
                <AmountText value={formatCurrency(monthlyEquivalentTotal)} variant="titleMedium" />
              </View>
              {nextRecurring && (
                <View style={styles.recurringNext}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Next
                  </Text>
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
                    {nextRecurring.name} · {formatDate(nextRecurring.next_date)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      </DismissKeyboardView>

      <Portal>
        <Dialog visible={isPayDialogVisible} onDismiss={() => setPayDialogVisible(false)}>
          <Dialog.Title>Pay Credit Card</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
              Card Balance: {formatCurrency(card.unpaid)}
            </Text>
            {hasSharedResponsibility && (
              <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
                You owe {formatCurrency(card.myResponsibility)} · Others owe {formatCurrency(card.othersOwe)}
              </Text>
            )}
            <AppTextInput
              label="Payment Amount"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
              style={[styles.dialogField, styles.amountFieldSpacing]}
            />

            {hasSharedResponsibility && (
              <View style={styles.payWhatIOweRow}>
                <Button mode="outlined" compact onPress={() => setPayAmount(card.payWhatIOwe)} style={styles.payWhatIOweButton}>
                  Pay What I Owe ({formatCurrency(card.payWhatIOwe)})
                </Button>
              </View>
            )}

            <Text variant="labelLarge" style={styles.dialogLabel}>
              Pay From
            </Text>
            {accounts.length === 0 ? (
              <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
                No accounts yet. Add one from the Accounts tab.
              </Text>
            ) : (
              <Menu
                visible={isAccountMenuVisible}
                onDismiss={() => setAccountMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setAccountMenuVisible(true)} icon="bank-outline">
                    {selectedAccount ? selectedAccount.name : 'Select an account'}
                  </Button>
                }
              >
                {accounts.map((a) => (
                  <Menu.Item key={a.id} title={`${a.name} (${formatCurrency(a.available)} available)`} onPress={() => selectPayAccount(a)} />
                ))}
              </Menu>
            )}

            {selectedAccount && isLoadingPayAccount && <ActivityIndicator style={styles.dialogField} />}

            {selectedAccount && payAccountDetail && (
              <View style={styles.payAccountSummary}>
                <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Current: {formatCurrency(payAccountDetail.account.balance)} · Available: {formatCurrency(payAccountDetail.account.available)}
                </Text>

                <Text variant="labelLarge" style={styles.dialogLabel}>
                  Use
                </Text>
                <RadioButton.Group value={paySource} onValueChange={(value) => setPaySource(value as PaySource)}>
                  <RadioButton.Item label="Available Money" value="available" style={styles.radioItem} />
                  <RadioButton.Item label="Set Aside Money" value="reservation" style={styles.radioItem} />
                </RadioButton.Group>

                {paySource === 'reservation' && (
                  <View style={styles.reservationPicker}>
                    {payAccountDetail.reservations.filter((r) => r.status === 'reserved').length === 0 ? (
                      <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
                        No active reservations on this account.
                      </Text>
                    ) : (
                      <RadioButton.Group value={payReservationId ?? ''} onValueChange={(value) => setPayReservationId(value)}>
                        {payAccountDetail.reservations
                          .filter((r) => r.status === 'reserved')
                          .map((r) => (
                            <RadioButton.Item
                              key={r.id}
                              label={`${r.name} — ${formatCurrency(r.amount)}`}
                              value={r.id}
                              style={styles.radioItem}
                            />
                          ))}
                      </RadioButton.Group>
                    )}
                  </View>
                )}
              </View>
            )}

            {payError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {payError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPayDialogVisible(false)} disabled={isSubmittingPay}>
              Cancel
            </Button>
            <Button onPress={handlePayFromAccount} loading={isSubmittingPay} disabled={isSubmittingPay}>
              Pay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <DoneAccessory />
    </>
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
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
    marginBottom: spacing.base,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bank: {
    marginBottom: spacing.xs,
  },
  unpaidAmount: {
    marginTop: spacing.base,
  },
  unpaidLabel: {
    marginTop: 2,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.14,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  responsibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  responsibilityRight: {
    alignItems: 'flex-end',
  },
  dueText: {
    marginTop: spacing.base,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  payButton: {
    flex: 1,
    borderRadius: radii.button,
  },
  payButtonContent: {
    height: 48,
  },
  secondaryButton: {
    borderRadius: radii.button,
  },
  section: {
    marginBottom: spacing.xl,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  listRowText: {
    flex: 1,
  },
  recurringSummary: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.xs,
  },
  recurringNext: {
    flex: 1,
  },
  mutedLabel: {
    marginBottom: spacing.xs,
  },
  dialogLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  payWhatIOweRow: {
    marginBottom: spacing.base,
  },
  payWhatIOweButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
  },
  dialogField: {
    marginBottom: spacing.md,
  },
  amountFieldSpacing: {
    marginTop: spacing.sm,
  },
  payAccountSummary: {
    marginTop: spacing.md,
  },
  radioItem: {
    paddingHorizontal: 0,
  },
  reservationPicker: {
    marginLeft: spacing.sm,
  },
  error: {
    marginTop: spacing.xs,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
  },
});
