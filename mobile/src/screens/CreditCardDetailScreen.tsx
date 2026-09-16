import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  IconButton,
  List,
  Menu,
  Portal,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { creditCardService, type CreditCardDetail, type PaySource } from '../services/creditCardService';
import { bankAccountService, type BankAccount, type BankAccountDetail } from '../services/bankAccountService';
import { ServiceError } from '../services/errors';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/cardStatus';
import { formatCurrency, formatDate, todayISODate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import DateField from '../components/DateField';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import type { CreditCardsStackParamList } from '../navigation/CreditCardsNavigator';

type Props = NativeStackScreenProps<CreditCardsStackParamList, 'CreditCardDetail'>;

export default function CreditCardDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { cardId } = route.params;

  const [detail, setDetail] = useState<CreditCardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPaymentDialogVisible, setPaymentDialogVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
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
    }, [loadDetail])
  );

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

  function openPaymentDialog() {
    setPaymentAmount('');
    setPaymentDate(todayISODate());
    setPaymentError(null);
    setPaymentDialogVisible(true);
  }

  async function handleRecordPayment() {
    const amountValue = Number(paymentAmount);
    if (!paymentAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setPaymentError('Enter a valid amount');
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentError(null);
    try {
      await creditCardService.recordPayment(cardId, { amount: amountValue, date: paymentDate });
      setPaymentDialogVisible(false);
      await loadDetail();
    } catch (err) {
      setPaymentError(err instanceof ServiceError ? err.message : 'Unable to record payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  }

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centered}>
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

  return (
    <>
      <DismissKeyboardView>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text variant="bodyMedium" style={styles.bank}>
            {card.bank}
          </Text>
          <Text variant="displaySmall">{formatCurrency(card.unpaid)}</Text>
          <Text variant="bodyMedium" style={styles.unpaidLabel}>
            Unpaid balance
          </Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[card.status] }]}>
              <Text variant="labelSmall" style={styles.statusText}>
                {STATUS_LABELS[card.status]}
              </Text>
            </View>
            <Text variant="bodyMedium">Due {formatDate(card.next_due_date)}</Text>
          </View>

          {Number(card.othersOwe) > 0 && (
            <View style={styles.responsibilityRow}>
              <View style={styles.summaryCol}>
                <Text variant="bodySmall" style={styles.mutedLabel}>
                  My Responsibility
                </Text>
                <Text variant="titleMedium">{formatCurrency(card.myResponsibility)}</Text>
              </View>
              <View style={styles.summaryCol}>
                <Text variant="bodySmall" style={styles.mutedLabel}>
                  Others Owe Me
                </Text>
                <Text variant="titleMedium">{formatCurrency(card.othersOwe)}</Text>
              </View>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button mode="contained" onPress={openPaymentDialog} style={styles.actionButton} icon="cash-plus">
              Record Payment
            </Button>
            <Button mode="outlined" onPress={openPayDialog} style={styles.actionButton} icon="bank-transfer-out">
              Pay from Account
            </Button>
          </View>
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Transactions
        </Text>
        {transactions.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No transactions on this card yet.
          </Text>
        ) : (
          transactions.map((item, index) => (
            <View key={item.id}>
              <List.Item
                title={item.category}
                description={
                  Number(item.othersOwe) > 0
                    ? `${item.merchant ? item.merchant + ' · ' : ''}${formatDate(item.date)}\nMy Share ${formatCurrency(item.myShare)} · Others Owe Me ${formatCurrency(item.othersOwe)}`
                    : `${item.merchant ? item.merchant + ' · ' : ''}${formatDate(item.date)}`
                }
                descriptionNumberOfLines={2}
                right={() => (
                  <Text variant="titleMedium" style={styles.rowAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                )}
              />
              {index < transactions.length - 1 && <Divider />}
            </View>
          ))
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Payments
        </Text>
        {payments.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No payments recorded yet.
          </Text>
        ) : (
          payments.map((item, index) => (
            <View key={item.id}>
              <List.Item
                title={formatCurrency(item.amount)}
                description={item.bank_account_name ? `Paid from ${item.bank_account_name} · ${formatDate(item.date)}` : formatDate(item.date)}
                left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
              />
              {index < payments.length - 1 && <Divider />}
            </View>
          ))
        )}
      </ScrollView>
      </DismissKeyboardView>

      <Portal>
        <Dialog visible={isPaymentDialogVisible} onDismiss={() => setPaymentDialogVisible(false)}>
          <Dialog.Title>Record Payment</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Amount"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<TextInput.Affix text="₱" />}
              style={styles.dialogField}
            />
            <DateField value={paymentDate} onChange={setPaymentDate} />
            {paymentError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {paymentError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPaymentDialogVisible(false)} disabled={isSubmittingPayment}>
              Cancel
            </Button>
            <Button onPress={handleRecordPayment} loading={isSubmittingPayment} disabled={isSubmittingPayment}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isPayDialogVisible} onDismiss={() => setPayDialogVisible(false)}>
          <Dialog.Title>Pay from Account</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Amount"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<TextInput.Affix text="₱" />}
              style={styles.dialogField}
            />

            {Number(card.othersOwe) > 0 && (
              <View style={styles.payWhatIOweRow}>
                <Text variant="bodySmall" style={styles.mutedLabel}>
                  Outstanding {formatCurrency(card.unpaid)} · My Share {formatCurrency(card.myResponsibility)} · Others Owe Me{' '}
                  {formatCurrency(card.othersOwe)}
                </Text>
                <Button mode="outlined" compact onPress={() => setPayAmount(card.payWhatIOwe)} style={styles.payWhatIOweButton}>
                  Pay What I Owe ({formatCurrency(card.payWhatIOwe)})
                </Button>
              </View>
            )}

            <Text variant="labelLarge" style={styles.dialogLabel}>
              Pay From
            </Text>
            {accounts.length === 0 ? (
              <Text variant="bodySmall" style={styles.mutedLabel}>
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
                <Text variant="bodySmall" style={styles.mutedLabel}>
                  Current: {formatCurrency(payAccountDetail.account.balance)} · Available: {formatCurrency(payAccountDetail.account.available)}
                </Text>

                <Text variant="labelLarge" style={styles.dialogLabel}>
                  Use
                </Text>
                <RadioButton.Group value={paySource} onValueChange={(value) => setPaySource(value as PaySource)}>
                  <RadioButton.Item label="Available Money" value="available" style={styles.radioItem} />
                  <RadioButton.Item label="Reserved Money" value="reservation" style={styles.radioItem} />
                </RadioButton.Group>

                {paySource === 'reservation' && (
                  <View style={styles.reservationPicker}>
                    {payAccountDetail.reservations.filter((r) => r.status === 'reserved').length === 0 ? (
                      <Text variant="bodySmall" style={styles.mutedLabel}>
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
  bank: {
    opacity: 0.6,
    marginBottom: 4,
  },
  unpaidLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
  },
  responsibilityRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 16,
  },
  summaryCol: {
    alignItems: 'center',
  },
  payWhatIOweRow: {
    marginBottom: 16,
  },
  payWhatIOweButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    minWidth: 0,
  },
  mutedLabel: {
    opacity: 0.6,
  },
  dialogLabel: {
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  rowAmount: {
    alignSelf: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  dialogField: {
    marginBottom: 12,
  },
  payAccountSummary: {
    marginTop: 12,
  },
  radioItem: {
    paddingHorizontal: 0,
  },
  reservationPicker: {
    marginLeft: 8,
  },
  error: {
    marginTop: 4,
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
});
