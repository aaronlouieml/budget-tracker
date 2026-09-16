import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Divider, IconButton, List, Menu, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { personService, type PersonDetail } from '../services/personService';
import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { formatCurrency, formatDate, todayISODate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import type { PeopleStackParamList } from '../navigation/PeopleNavigator';

type Props = NativeStackScreenProps<PeopleStackParamList, 'PersonDetail'>;

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export default function PersonDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { personId } = route.params;

  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const [isPayDialogVisible, setPayDialogVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [isAccountMenuVisible, setAccountMenuVisible] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadDetail = useCallback(async () => {
    setError(null);
    try {
      const data = await personService.fetchPerson(personId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load person.');
    } finally {
      setIsLoading(false);
    }
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
      bankAccountService
        .listAccounts()
        .then(setAccounts)
        .catch(() => {
          // Non-critical: the "Received Via" picker just falls back to "no accounts" state.
        });
    }, [loadDetail])
  );

  function handleDeletePerson() {
    if (!detail) return;
    confirmDestructive('Remove person?', `${detail.person.name} and their share/payment history will be removed.`, 'Remove', async () => {
      try {
        await personService.deletePerson(personId);
        navigation.goBack();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to remove person.');
      }
    });
  }

  useEffect(() => {
    if (!detail) return;
    navigation.setOptions({
      title: detail.person.name,
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton icon="pencil-outline" onPress={() => navigation.navigate('PersonForm', { person: detail.person })} />
          <IconButton icon="delete-outline" onPress={handleDeletePerson} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  function openPayDialog() {
    setPayAmount(detail ? detail.outstanding : '');
    setPayAccountId(null);
    setPayError(null);
    setPayDialogVisible(true);
  }

  async function handleRecordPayment() {
    const amountValue = Number(payAmount);
    if (!payAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setPayError('Enter a valid amount');
      return;
    }
    if (payAccountId === null) {
      setPayError('Select where you received the money');
      return;
    }

    setIsSubmittingPay(true);
    setPayError(null);
    try {
      await personService.recordPayment(personId, { amount: amountValue, bankAccountId: payAccountId, date: todayISODate() });
      setPayDialogVisible(false);
      await loadDetail();
    } catch (err) {
      setPayError(err instanceof ServiceError ? err.message : 'Unable to record payment.');
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
          {error ?? 'Unable to load person.'}
        </Text>
        <Button mode="contained" onPress={loadDetail} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const { outstanding, shares, payments, person } = detail;
  const selectedAccount = accounts.find((a) => a.id === payAccountId);

  return (
    <>
      <DismissKeyboardView>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text variant="displaySmall">{formatCurrency(outstanding)}</Text>
          <Text variant="bodyMedium" style={styles.mutedLabel}>
            Net
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Owes Me
              </Text>
              <Text variant="titleMedium">{formatCurrency(person.owesMe)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                I Owe
              </Text>
              <Text variant="titleMedium">{formatCurrency(person.iOwe)}</Text>
            </View>
          </View>

          {Number(outstanding) > 0 && (
            <Button mode="contained" onPress={openPayDialog} icon="cash-check" style={styles.payButton}>
              Record Payment
            </Button>
          )}
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Transactions
        </Text>
        {shares.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No shared expenses yet.
          </Text>
        ) : (
          shares.map((share, index) => (
            <View key={share.id}>
              <List.Item
                title={share.expense.merchant || share.expense.category}
                description={`${formatDate(share.expense.date)} · Total ${formatCurrency(share.expense.total)}${
                  share.expense.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[share.expense.payment_method] ?? share.expense.payment_method) : ''
                }`}
                right={() => (
                  <View style={styles.shareRight}>
                    <Text variant="titleMedium">{formatCurrency(share.amount)}</Text>
                    <Text variant="bodySmall" style={share.status === 'paid' ? styles.paidLabel : styles.owesLabel}>
                      {share.status === 'paid' ? 'Paid ✓' : `${formatCurrency(share.remaining)} remaining`}
                    </Text>
                  </View>
                )}
              />
              {index < shares.length - 1 && <Divider />}
            </View>
          ))
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Payment History
        </Text>
        {payments.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No payments recorded yet.
          </Text>
        ) : (
          payments.map((payment, index) => (
            <View key={payment.id}>
              <List.Item
                title={formatCurrency(payment.amount)}
                description={`${formatDate(payment.date)} · Received via ${payment.bank_account_name ?? 'an account'}`}
                left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
              />
              {index < payments.length - 1 && <Divider />}
            </View>
          ))
        )}
      </ScrollView>
      </DismissKeyboardView>

      <Portal>
        <Dialog visible={isPayDialogVisible} onDismiss={() => setPayDialogVisible(false)}>
          <Dialog.Title>{detail.person.name} Pays You</Dialog.Title>
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

            <Text variant="labelLarge" style={styles.dialogLabel}>
              Received Via
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
                  <Menu.Item
                    key={a.id}
                    title={a.name}
                    onPress={() => {
                      setPayAccountId(a.id);
                      setAccountMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
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
            <Button onPress={handleRecordPayment} loading={isSubmittingPay} disabled={isSubmittingPay}>
              Record
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
    marginBottom: 16,
  },
  mutedLabel: {
    opacity: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 16,
  },
  summaryCol: {
    alignItems: 'center',
  },
  payButton: {
    marginTop: 16,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  shareRight: {
    alignItems: 'flex-end',
  },
  paidLabel: {
    color: '#4CAF50',
  },
  owesLabel: {
    opacity: 0.6,
  },
  headerActions: {
    flexDirection: 'row',
  },
  dialogField: {
    marginBottom: 12,
  },
  dialogLabel: {
    marginBottom: 8,
    marginTop: 4,
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
