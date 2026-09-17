import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Divider, IconButton, List, Menu, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  bankAccountService,
  type ActivityItem,
  type BankAccount,
  type BankAccountDetail,
  type Reservation,
  type ReservationPurpose,
} from '../services/bankAccountService';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { transferService } from '../services/transferService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES, RESERVATION_PURPOSES } from '../constants/accountOptions';
import { formatCurrency, formatDate, todayISODate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import type { AccountsStackParamList } from '../navigation/AccountsNavigator';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AccountDetail'>;

const TYPE_LABELS = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));
const PURPOSE_LABELS = Object.fromEntries(RESERVATION_PURPOSES.map((p) => [p.value, p.label]));

const ACTIVITY_ICONS: Record<ActivityItem['type'], string> = {
  expense: 'cart-outline',
  credit_card_payment: 'credit-card-outline',
  transfer: 'bank-transfer',
  incoming: 'cash-plus',
  reimbursement: 'account-cash-outline',
  plan_import: 'calendar-check-outline',
};

export default function BankAccountDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { accountId } = route.params;

  const [detail, setDetail] = useState<BankAccountDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CreditCard[]>([]);

  const [isReserveDialogVisible, setReserveDialogVisible] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [reserveName, setReserveName] = useState('');
  const [reserveAmount, setReserveAmount] = useState('');
  const [reservePurpose, setReservePurpose] = useState<ReservationPurpose>('credit_card_payment');
  const [reserveCardId, setReserveCardId] = useState<string | null>(null);
  const [isCardMenuVisible, setCardMenuVisible] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [isSubmittingReserve, setIsSubmittingReserve] = useState(false);

  const [isIncomingDialogVisible, setIncomingDialogVisible] = useState(false);
  const [incomingAmount, setIncomingAmount] = useState('');
  const [incomingDescription, setIncomingDescription] = useState('');
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [isSubmittingIncoming, setIsSubmittingIncoming] = useState(false);

  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isTransferDialogVisible, setTransferDialogVisible] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferToId, setTransferToId] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState('');
  const [isTransferAccountMenuVisible, setTransferAccountMenuVisible] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  const loadDetail = useCallback(async () => {
    setError(null);
    try {
      const [data, activityData] = await Promise.all([bankAccountService.fetchAccount(accountId), bankAccountService.getActivity(accountId)]);
      setDetail(data);
      setActivity(activityData);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load account.');
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
      creditCardService
        .listCards()
        .then(setCards)
        .catch(() => {
          // Non-critical: the credit card picker just falls back to "no cards" state.
        });
      bankAccountService
        .listAccounts()
        .then((all) => setAccounts(all.filter((a) => a.id !== accountId)))
        .catch(() => {
          // Non-critical: the transfer destination picker just falls back to "no accounts" state.
        });
    }, [loadDetail, accountId])
  );

  function handleDeleteAccount() {
    if (!detail) return;
    confirmDestructive('Delete account?', `${detail.account.name} and its reservations will be removed.`, 'Delete', async () => {
      try {
        await bankAccountService.deleteAccount(accountId);
        navigation.goBack();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to delete account.');
      }
    });
  }

  useEffect(() => {
    if (!detail) return;
    navigation.setOptions({
      title: detail.account.name,
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton icon="pencil-outline" onPress={() => navigation.navigate('AccountForm', { account: detail.account })} />
          <IconButton icon="delete-outline" onPress={handleDeleteAccount} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  function openReserveDialog() {
    setEditingReservationId(null);
    setReserveName('');
    setReserveAmount('');
    setReservePurpose('credit_card_payment');
    setReserveCardId(null);
    setReserveError(null);
    setReserveDialogVisible(true);
  }

  function openEditReservationDialog(reservation: Reservation) {
    setEditingReservationId(reservation.id);
    setReserveName(reservation.name);
    setReserveAmount(reservation.amount);
    setReservePurpose(reservation.purpose);
    setReserveCardId(reservation.credit_card_id);
    setReserveError(null);
    setReserveDialogVisible(true);
  }

  async function handleSaveReservation() {
    const name = reserveName.trim();
    if (!name) {
      setReserveError('Enter a name');
      return;
    }
    const amountValue = Number(reserveAmount);
    if (!reserveAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setReserveError('Enter a valid amount');
      return;
    }

    setIsSubmittingReserve(true);
    setReserveError(null);
    try {
      const input = {
        name,
        amount: amountValue,
        purpose: reservePurpose,
        creditCardId: reservePurpose === 'credit_card_payment' ? reserveCardId : null,
      };
      if (editingReservationId !== null) {
        await bankAccountService.updateReservation(accountId, editingReservationId, input);
      } else {
        await bankAccountService.createReservation(accountId, input);
      }
      setReserveDialogVisible(false);
      await loadDetail();
    } catch (err) {
      setReserveError(err instanceof ServiceError ? err.message : 'Unable to save reservation.');
    } finally {
      setIsSubmittingReserve(false);
    }
  }

  function handleDeleteReservation(reservationId: string) {
    confirmDestructive('Remove reservation?', 'This money will become available again.', 'Remove', async () => {
      try {
        await bankAccountService.deleteReservation(accountId, reservationId);
        await loadDetail();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to remove reservation.');
      }
    });
  }

  function openIncomingDialog() {
    setIncomingAmount('');
    setIncomingDescription('');
    setIncomingError(null);
    setIncomingDialogVisible(true);
  }

  async function handleCreateIncoming() {
    const amountValue = Number(incomingAmount);
    if (!incomingAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setIncomingError('Enter a valid amount');
      return;
    }

    setIsSubmittingIncoming(true);
    setIncomingError(null);
    try {
      await bankAccountService.createIncoming(accountId, { amount: amountValue, description: incomingDescription.trim() || null });
      setIncomingDialogVisible(false);
      await loadDetail();
    } catch (err) {
      setIncomingError(err instanceof ServiceError ? err.message : 'Unable to record incoming money.');
    } finally {
      setIsSubmittingIncoming(false);
    }
  }

  function handleDeleteIncoming(incomingId: string) {
    confirmDestructive('Remove incoming money?', 'This will no longer count toward potential available.', 'Remove', async () => {
      try {
        await bankAccountService.deleteIncoming(accountId, incomingId);
        await loadDetail();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to remove incoming money.');
      }
    });
  }

  function openTransferDialog() {
    setTransferAmount('');
    setTransferToId(null);
    setTransferNote('');
    setTransferError(null);
    setTransferDialogVisible(true);
  }

  async function handleCreateTransfer() {
    const amountValue = Number(transferAmount);
    if (!transferAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setTransferError('Enter a valid amount');
      return;
    }
    if (!transferToId) {
      setTransferError('Select a destination account');
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError(null);
    try {
      await transferService.createTransfer({
        fromAccountId: accountId,
        toAccountId: transferToId,
        amount: amountValue,
        note: transferNote.trim() || null,
        date: todayISODate(),
      });
      setTransferDialogVisible(false);
      await loadDetail();
    } catch (err) {
      setTransferError(err instanceof ServiceError ? err.message : 'Unable to transfer.');
    } finally {
      setIsSubmittingTransfer(false);
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
          {error ?? 'Unable to load account.'}
        </Text>
        <Button mode="contained" onPress={loadDetail} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const { account, reservations, incoming, incomingTotal, potentialAvailable } = detail;
  const activeReservations = reservations.filter((r) => r.status === 'reserved');
  const fulfilledReservations = reservations.filter((r) => r.status === 'fulfilled');
  const selectedCard = cards.find((c) => c.id === reserveCardId);

  return (
    <>
      <DismissKeyboardView>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text variant="bodyMedium" style={styles.type}>
            {TYPE_LABELS[account.type] ?? account.type}
          </Text>
          <Text variant="displaySmall">{formatCurrency(account.balance)}</Text>
          <Text variant="bodyMedium" style={styles.mutedLabel}>
            Current Balance
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Reserved
              </Text>
              <Text variant="titleMedium">{formatCurrency(account.reserved)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text variant="bodySmall" style={styles.mutedLabel}>
                Available
              </Text>
              <Text variant="titleMedium">{formatCurrency(account.available)}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Button mode="contained" onPress={openReserveDialog} icon="lock-outline" style={styles.actionButton}>
              Reserve Money
            </Button>
            <Button mode="outlined" onPress={openIncomingDialog} icon="cash-plus" style={styles.actionButton}>
              Incoming
            </Button>
            <Button mode="outlined" onPress={openTransferDialog} icon="bank-transfer" style={styles.actionButton} disabled={accounts.length === 0}>
              Transfer
            </Button>
          </View>
        </View>

        {Number(incomingTotal) > 0 && (
          <View style={styles.incomingSummary}>
            <View style={styles.summaryRowSpread}>
              <Text variant="bodyMedium">Incoming</Text>
              <Text variant="bodyMedium">{formatCurrency(incomingTotal)}</Text>
            </View>
            <View style={styles.summaryRowSpread}>
              <Text variant="bodyMedium">Potential available after incoming</Text>
              <Text variant="titleMedium">{formatCurrency(potentialAvailable)}</Text>
            </View>
          </View>
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Reservations
        </Text>
        {activeReservations.length === 0 && fulfilledReservations.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No reservations yet.
          </Text>
        ) : (
          [...activeReservations, ...fulfilledReservations].map((item, index, arr) => (
            <View key={item.id}>
              <List.Item
                title={`${item.name} · ${formatCurrency(item.amount)}`}
                description={`${PURPOSE_LABELS[item.purpose] ?? item.purpose}${
                  item.credit_card_name ? ' · ' + item.credit_card_name : ''
                } · ${item.status === 'fulfilled' ? 'Fulfilled' : 'Reserved'} · ${formatDate(item.created_at.slice(0, 10))}`}
                onPress={item.status === 'reserved' ? () => openEditReservationDialog(item) : undefined}
                right={
                  item.status === 'reserved'
                    ? () => (
                        <View style={styles.reservationActions}>
                          <IconButton icon="pencil-outline" onPress={() => openEditReservationDialog(item)} />
                          <IconButton icon="close" onPress={() => handleDeleteReservation(item.id)} />
                        </View>
                      )
                    : undefined
                }
              />
              {index < arr.length - 1 && <Divider />}
            </View>
          ))
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Incoming Money
        </Text>
        {incoming.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No incoming money expected.
          </Text>
        ) : (
          incoming.map((item, index) => (
            <View key={item.id}>
              <List.Item
                title={formatCurrency(item.amount)}
                description={`${item.description ? item.description + ' · ' : ''}${formatDate(item.created_at.slice(0, 10))}`}
                right={() => <IconButton icon="close" onPress={() => handleDeleteIncoming(item.id)} />}
              />
              {index < incoming.length - 1 && <Divider />}
            </View>
          ))
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Recent Activity
        </Text>
        {activity.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptyText}>
            No activity yet.
          </Text>
        ) : (
          activity.map((item, index) => (
            <View key={`${item.type}-${item.id}`}>
              <List.Item
                title={item.label}
                description={`${item.detail ? item.detail + ' · ' : ''}${formatDate(item.date)}`}
                left={(props) => <List.Icon {...props} icon={ACTIVITY_ICONS[item.type]} />}
                right={() => (
                  <Text
                    variant="titleMedium"
                    style={[styles.activityAmount, { color: item.direction === 'in' ? theme.colors.primary : theme.colors.onSurface }]}
                  >
                    {item.direction === 'in' ? '+' : '-'}
                    {formatCurrency(item.amount)}
                  </Text>
                )}
              />
              {index < activity.length - 1 && <Divider />}
            </View>
          ))
        )}
      </ScrollView>
      </DismissKeyboardView>

      <Portal>
        <Dialog visible={isReserveDialogVisible} onDismiss={() => setReserveDialogVisible(false)}>
          <Dialog.Title>{editingReservationId !== null ? 'Edit Reservation' : 'Reserve Money'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={reserveName}
              onChangeText={setReserveName}
              placeholder="BPI Credit Card"
              style={styles.dialogField}
            />

            <TextInput
              label="Amount"
              value={reserveAmount}
              onChangeText={setReserveAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<TextInput.Affix text="₱" />}
              style={styles.dialogField}
            />

            <Text variant="labelLarge" style={styles.dialogLabel}>
              Purpose
            </Text>
            <View style={styles.chipWrap}>
              {RESERVATION_PURPOSES.map((p) => (
                <Button
                  key={p.value}
                  mode={reservePurpose === p.value ? 'contained' : 'outlined'}
                  onPress={() => setReservePurpose(p.value)}
                  compact
                  style={styles.purposeButton}
                >
                  {p.label}
                </Button>
              ))}
            </View>

            {reservePurpose === 'credit_card_payment' && (
              <>
                <Text variant="labelLarge" style={styles.dialogLabel}>
                  Credit Card (optional)
                </Text>
                {cards.length === 0 ? (
                  <Text variant="bodySmall" style={styles.mutedLabel}>
                    No credit cards yet.
                  </Text>
                ) : (
                  <Menu
                    visible={isCardMenuVisible}
                    onDismiss={() => setCardMenuVisible(false)}
                    anchor={
                      <Button mode="outlined" onPress={() => setCardMenuVisible(true)} icon="credit-card-outline">
                        {selectedCard ? selectedCard.name : 'Select a card'}
                      </Button>
                    }
                  >
                    {cards.map((c) => (
                      <Menu.Item
                        key={c.id}
                        title={`${c.name} (${c.bank})`}
                        onPress={() => {
                          setReserveCardId(c.id);
                          setCardMenuVisible(false);
                        }}
                      />
                    ))}
                  </Menu>
                )}
              </>
            )}

            {reserveError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {reserveError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReserveDialogVisible(false)} disabled={isSubmittingReserve}>
              Cancel
            </Button>
            <Button onPress={handleSaveReservation} loading={isSubmittingReserve} disabled={isSubmittingReserve}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isIncomingDialogVisible} onDismiss={() => setIncomingDialogVisible(false)}>
          <Dialog.Title>Incoming Money</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Amount"
              value={incomingAmount}
              onChangeText={setIncomingAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<TextInput.Affix text="₱" />}
              style={styles.dialogField}
            />
            <TextInput
              label="Description (optional)"
              value={incomingDescription}
              onChangeText={setIncomingDescription}
              placeholder="Salary"
              style={styles.dialogField}
            />
            {incomingError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {incomingError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIncomingDialogVisible(false)} disabled={isSubmittingIncoming}>
              Cancel
            </Button>
            <Button onPress={handleCreateIncoming} loading={isSubmittingIncoming} disabled={isSubmittingIncoming}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isTransferDialogVisible} onDismiss={() => setTransferDialogVisible(false)}>
          <Dialog.Title>Transfer Money</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.mutedLabel}>
              From {account.name} · Available {formatCurrency(account.available)}
            </Text>

            <TextInput
              label="Amount"
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<TextInput.Affix text="₱" />}
              style={styles.dialogField}
            />

            <Text variant="labelLarge" style={styles.dialogLabel}>
              To
            </Text>
            {accounts.length === 0 ? (
              <Text variant="bodySmall" style={styles.mutedLabel}>
                No other accounts yet.
              </Text>
            ) : (
              <Menu
                visible={isTransferAccountMenuVisible}
                onDismiss={() => setTransferAccountMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setTransferAccountMenuVisible(true)} icon="bank-outline">
                    {accounts.find((a) => a.id === transferToId)?.name ?? 'Select an account'}
                  </Button>
                }
              >
                {accounts.map((a) => (
                  <Menu.Item
                    key={a.id}
                    title={a.name}
                    onPress={() => {
                      setTransferToId(a.id);
                      setTransferAccountMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
            )}

            <TextInput
              label="Note (optional)"
              value={transferNote}
              onChangeText={setTransferNote}
              placeholder="Rent money"
              style={[styles.dialogField, styles.transferNoteField]}
            />

            {transferError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {transferError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTransferDialogVisible(false)} disabled={isSubmittingTransfer}>
              Cancel
            </Button>
            <Button onPress={handleCreateTransfer} loading={isSubmittingTransfer} disabled={isSubmittingTransfer}>
              Transfer
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
  type: {
    opacity: 0.6,
    marginBottom: 4,
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
  summaryRowSpread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  incomingSummary: {
    marginBottom: 16,
    padding: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    minWidth: 0,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  reservationActions: {
    flexDirection: 'row',
  },
  dialogField: {
    marginBottom: 12,
  },
  dialogLabel: {
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  purposeButton: {
    marginBottom: 4,
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
  activityAmount: {
    alignSelf: 'center',
  },
  transferNoteField: {
    marginTop: 12,
  },
});
