import { useCallback, useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Dialog, Divider, IconButton, Menu, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  bankAccountService,
  type ActivityItem,
  type BankAccount,
  type BankAccountDetail,
  type Reservation,
  type ReservationPurpose,
  type IncomingSourceType,
} from '../services/bankAccountService';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { transferService } from '../services/transferService';
import { personService, type Person } from '../services/personService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES, RESERVATION_PURPOSES, INCOMING_SOURCE_TYPES } from '../constants/accountOptions';
import { RESERVATION_CATEGORIES } from '../constants/reservationCategories';
import { formatCurrency, formatDate, formatShortDate, todayISODate } from '../utils/format';
import { confirmDestructive, confirmAction } from '../utils/confirm';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import AppTextInput from '../components/AppTextInput';
import DateField from '../components/DateField';
import SectionHeader from '../components/SectionHeader';
import AmountText from '../components/AmountText';
import EmptyState from '../components/EmptyState';
import StatusPill from '../components/StatusPill';
import { spacing, screenPadding } from '../theme/spacing';
import { radii } from '../theme/radii';
import { tabularNumberStyle } from '../theme/typography';
import type { AccountsStackParamList } from '../navigation/AccountsNavigator';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AccountDetail'>;

const TYPE_LABELS = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));
const PURPOSE_LABELS = Object.fromEntries(RESERVATION_PURPOSES.map((p) => [p.value, p.label]));
const INCOMING_SOURCE_LABELS = Object.fromEntries(INCOMING_SOURCE_TYPES.map((s) => [s.value, s.label])) as Record<IncomingSourceType, string>;

const ACTIVITY_ICONS: Record<ActivityItem['type'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  expense: 'cart-outline',
  credit_card_payment: 'credit-card-outline',
  transfer: 'bank-transfer',
  incoming: 'cash-plus',
  reimbursement: 'account-cash-outline',
  plan_import: 'calendar-check-outline',
  set_aside_used: 'lock-open-variant-outline',
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
  const [reserveCategory, setReserveCategory] = useState('');
  const [hasPlannedDate, setHasPlannedDate] = useState(false);
  const [reservePlannedDate, setReservePlannedDate] = useState(todayISODate());
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [isSubmittingReserve, setIsSubmittingReserve] = useState(false);


  const [isDepositDialogVisible, setDepositDialogVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDescription, setDepositDescription] = useState('');
  const [depositSourceType, setDepositSourceType] = useState<IncomingSourceType>('manual');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [payingPerson, setPayingPerson] = useState<Person | null>(null);
  const [owedPayAmount, setOwedPayAmount] = useState('');
  const [owedPayAccountId, setOwedPayAccountId] = useState<string | null>(null);
  const [isOwedAccountMenuVisible, setOwedAccountMenuVisible] = useState(false);
  const [owedPayError, setOwedPayError] = useState<string | null>(null);
  const [isSubmittingOwedPay, setIsSubmittingOwedPay] = useState(false);

  const [flash, setFlash] = useState<string | null>(null);

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
      personService
        .listPeople()
        .then(setPeople)
        .catch(() => {
          // Non-critical: the Coming In section just won't show who owes money.
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
    setReserveCategory('');
    setHasPlannedDate(false);
    setReservePlannedDate(todayISODate());
    setReserveError(null);
    setReserveDialogVisible(true);
  }

  function openEditReservationDialog(reservation: Reservation) {
    setEditingReservationId(reservation.id);
    setReserveName(reservation.name);
    setReserveAmount(reservation.amount);
    setReservePurpose(reservation.purpose);
    setReserveCardId(reservation.credit_card_id);
    setReserveCategory(reservation.category ?? '');
    setHasPlannedDate(reservation.planned_date !== null);
    setReservePlannedDate(reservation.planned_date ?? todayISODate());
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
        category: reserveCategory.trim() || null,
        plannedDate: hasPlannedDate ? reservePlannedDate : null,
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
    confirmDestructive('Remove this from Set Aside?', 'This money will become available again.', 'Remove', async () => {
      try {
        await bankAccountService.deleteReservation(accountId, reservationId);
        await loadDetail();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to remove reservation.');
      }
    });
  }

  function handleReleaseReservation(reservationId: string) {
    confirmAction('Mark as used?', 'This frees the amount back to your available money. Your balance stays the same.', 'Mark as Used', async () => {
      try {
        await bankAccountService.releaseReservation(accountId, reservationId);
        setFlash('Moved back to available');
        await loadDetail();
      } catch (err) {
        setError(err instanceof ServiceError ? err.message : 'Unable to release this reservation.');
      }
    });
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

  async function handleConfirmIncoming(incomingId: string) {
    try {
      await bankAccountService.confirmIncoming(accountId, incomingId);
      setFlash('Added to your balance');
      await loadDetail();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to add this to your account.');
    }
  }

  function openDepositDialog() {
    setDepositAmount('');
    setDepositDescription('');
    setDepositSourceType('manual');
    setDepositError(null);
    setDepositDialogVisible(true);
  }

  async function handleCreateDeposit() {
    const amountValue = Number(depositAmount);
    if (!depositAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setDepositError('Enter a valid amount');
      return;
    }

    setIsSubmittingDeposit(true);
    setDepositError(null);
    try {
      await bankAccountService.createDeposit(accountId, {
        amount: amountValue,
        description: depositDescription.trim() || null,
        sourceType: depositSourceType,
      });
      setDepositDialogVisible(false);
      setFlash('Money added');
      await loadDetail();
    } catch (err) {
      setDepositError(err instanceof ServiceError ? err.message : 'Unable to add money.');
    } finally {
      setIsSubmittingDeposit(false);
    }
  }

  function openOwedPayDialog(person: Person) {
    setPayingPerson(person);
    setOwedPayAmount(person.owesMe);
    setOwedPayAccountId(accountId);
    setOwedPayError(null);
  }

  async function handleRecordOwedPayment() {
    if (!payingPerson) return;
    const amountValue = Number(owedPayAmount);
    if (!owedPayAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setOwedPayError('Enter a valid amount');
      return;
    }
    if (!owedPayAccountId) {
      setOwedPayError('Select where you received the money');
      return;
    }

    setIsSubmittingOwedPay(true);
    setOwedPayError(null);
    try {
      await personService.recordPayment(payingPerson.id, { amount: amountValue, bankAccountId: owedPayAccountId, date: todayISODate() });
      setPayingPerson(null);
      setFlash(`${payingPerson.name}'s payment recorded`);
      await loadDetail();
      personService.listPeople().then(setPeople).catch(() => {});
    } catch (err) {
      setOwedPayError(err instanceof ServiceError ? err.message : 'Unable to record payment.');
    } finally {
      setIsSubmittingOwedPay(false);
    }
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
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
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
  const isNegative = Number(account.balance) < 0;
  const activeReservations = [...reservations.filter((r) => r.status === 'reserved')].sort((a, b) => {
    if (a.planned_date && b.planned_date) return a.planned_date.localeCompare(b.planned_date);
    if (a.planned_date) return -1;
    if (b.planned_date) return 1;
    return 0;
  });
  const selectedCard = cards.find((c) => c.id === reserveCardId);
  // Group active (sorted-by-date) reservations under date headers, so it's
  // easy to see what's coming up and when - undated ones fall in their own
  // trailing group since they sort last.
  const reservationGroups: { label: string; items: Reservation[] }[] = [];
  for (const item of activeReservations) {
    const label = item.planned_date ? formatShortDate(item.planned_date) : 'No date';
    const lastGroup = reservationGroups[reservationGroups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item);
    } else {
      reservationGroups.push({ label, items: [item] });
    }
  }
  const pendingIncoming = incoming.filter((i) => i.status === 'pending');
  const owingPeople = people.filter((p) => Number(p.owesMe) > 0);
  const owedPaySelectedAccount = accounts.concat(account).find((a) => a.id === owedPayAccountId);

  return (
    <>
      <DismissKeyboardView>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={[styles.summary, { backgroundColor: theme.colors.primary }]}>
          <StatusPill label={(TYPE_LABELS[account.type] ?? account.type).toUpperCase()} tone="neutral" />
          <Text variant="displaySmall" style={[tabularNumberStyle, styles.balanceAmount, { color: theme.colors.onPrimary }]}>
            {formatCurrency(account.balance)}
          </Text>
          <Text variant="bodyMedium" style={[styles.mutedLabel, styles.heroMuted, { color: theme.colors.onPrimary }]}>
            Current Balance
          </Text>

          <View style={[styles.summaryDivider, { backgroundColor: theme.colors.onPrimary, opacity: 0.14 }]} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text variant="bodySmall" style={[styles.heroMuted, { color: theme.colors.onPrimary }]}>
                Your Slice
              </Text>
              <Text variant="titleMedium" style={[tabularNumberStyle, { color: theme.colors.tertiary }]}>
                {formatCurrency(account.available)}
              </Text>
            </View>
            <View style={styles.summaryCol}>
              <Text variant="bodySmall" style={[styles.heroMuted, { color: theme.colors.onPrimary }]}>
                Set Aside
              </Text>
              <Text variant="titleMedium" style={[tabularNumberStyle, { color: theme.colors.onPrimary }]}>
                {formatCurrency(account.reserved)}
              </Text>
            </View>
          </View>

          {Number(account.othersOwe) > 0 && (
            <View style={styles.responsibilityRow}>
              <MaterialCommunityIcons name="hand-coin-outline" size={14} color={theme.colors.onPrimary} style={styles.heroMuted} />
              <Text variant="bodySmall" style={[styles.heroMuted, { color: theme.colors.onPrimary }]}>
                Others owe you
              </Text>
              <Text variant="titleSmall" style={[tabularNumberStyle, styles.responsibilityAmount, { color: theme.colors.onPrimary }]}>
                {formatCurrency(account.othersOwe)}
              </Text>
            </View>
          )}
        </View>

        {isNegative && (
          <View style={[styles.negativeNotice, { backgroundColor: theme.colors.errorContainer, borderRadius: radii.card }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.onErrorContainer} />
            <Text variant="bodySmall" style={[styles.negativeNoticeText, { color: theme.colors.onErrorContainer }]}>
              This account is negative. Set Aside, transfers out, and expenses from this account are disabled until it's positive again.
            </Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={openReserveDialog} icon="lock-outline" style={styles.actionButton} disabled={isNegative}>
            Set Aside
          </Button>
          <Button mode="outlined" onPress={openDepositDialog} icon="wallet-plus-outline" style={styles.actionButton}>
            Add Money
          </Button>
          <Button mode="outlined" onPress={openTransferDialog} icon="bank-transfer" style={styles.actionButton} disabled={accounts.length === 0 || isNegative}>
            Transfer
          </Button>
        </View>

        {Number(incomingTotal) > 0 && (
          <View style={[styles.incomingSummary, { backgroundColor: theme.colors.surfaceVariant, borderRadius: radii.card }]}>
            <View style={styles.summaryRowSpread}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Coming In
              </Text>
              <AmountText value={formatCurrency(incomingTotal)} variant="bodyMedium" tone="positive" />
            </View>
            <View style={styles.summaryRowSpread}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Your slice once it arrives
              </Text>
              <AmountText value={formatCurrency(potentialAvailable)} variant="titleSmall" />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Set Aside" subtitle="Still your money - just saved for later." />
          {activeReservations.length === 0 ? (
            <EmptyState icon="lock-outline" title="Nothing set aside" description="Save a slice for rent, bills, or a credit card payment." compact />
          ) : (
            <>
              {reservationGroups.map((group) => (
                <View key={group.label} style={styles.dayGroup}>
                  <Text variant="labelLarge" style={[styles.dayLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {group.label}
                  </Text>
                  {group.items.map((item, index) => (
                    <View key={item.id}>
                      <View style={styles.listRow}>
                        <View style={styles.listRowText}>
                          <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                            {item.name}
                          </Text>
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                            {item.category || PURPOSE_LABELS[item.purpose] || item.purpose}
                            {item.credit_card_name ? ' · ' + item.credit_card_name : ''}
                          </Text>
                        </View>
                        <AmountText value={formatCurrency(item.amount)} variant="titleSmall" />
                        <View style={styles.reservationActions}>
                          <IconButton icon="check-circle-outline" size={18} onPress={() => handleReleaseReservation(item.id)} />
                          <IconButton icon="pencil-outline" size={18} onPress={() => openEditReservationDialog(item)} />
                          <IconButton icon="close" size={18} onPress={() => handleDeleteReservation(item.id)} />
                        </View>
                      </View>
                      {index < group.items.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Coming In" subtitle="Not in your pocket yet." />
          {pendingIncoming.length === 0 && owingPeople.length === 0 ? (
            <EmptyState icon="cash-clock" title="Nothing expected" description="Money friends owe you shows up here, so you can record it when they pay." compact />
          ) : (
            <>
              {pendingIncoming.map((item, index) => (
                <View key={item.id}>
                  <View style={styles.listRow}>
                    <MaterialCommunityIcons name="cash-plus" size={18} color={theme.colors.onSurfaceVariant} />
                    <View style={styles.listRowText}>
                      <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                        {item.description || INCOMING_SOURCE_LABELS[item.source_type]}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {formatDate(item.created_at.slice(0, 10))}
                      </Text>
                    </View>
                    <AmountText value={formatCurrency(item.amount)} variant="titleSmall" tone="positive" />
                    <View style={styles.reservationActions}>
                      <IconButton icon="check-circle-outline" size={18} onPress={() => handleConfirmIncoming(item.id)} />
                      <IconButton icon="close" size={18} onPress={() => handleDeleteIncoming(item.id)} />
                    </View>
                  </View>
                  {(index < pendingIncoming.length - 1 || owingPeople.length > 0) && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                </View>
              ))}
              {owingPeople.map((person, index) => (
                <View key={person.id}>
                  <View style={styles.listRow}>
                    <MaterialCommunityIcons name="hand-coin-outline" size={18} color={theme.colors.onSurfaceVariant} />
                    <View style={styles.listRowText}>
                      <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                        {person.name} owes you
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        From Money Owed
                      </Text>
                    </View>
                    <AmountText value={formatCurrency(person.owesMe)} variant="titleSmall" tone="positive" />
                    <IconButton icon="check-circle-outline" size={18} onPress={() => openOwedPayDialog(person)} />
                  </View>
                  {index < owingPeople.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent Activity" />
          {activity.length === 0 ? (
            <EmptyState icon="clock-outline" title="No activity yet" description="Everything that moves money in or out of this account shows up here." compact />
          ) : (
            activity.map((item, index) => (
              <View key={`${item.type}-${item.id}`}>
                <View style={styles.listRow}>
                  <MaterialCommunityIcons name={ACTIVITY_ICONS[item.type]} size={18} color={theme.colors.onSurfaceVariant} />
                  <View style={styles.listRowText}>
                    <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                      {item.label}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                      {item.detail ? item.detail + ' · ' : ''}
                      {formatDate(item.date)}
                    </Text>
                  </View>
                  <AmountText
                    value={item.direction === 'none' ? formatCurrency(item.amount) : `${item.direction === 'in' ? '+' : '-'}${formatCurrency(item.amount)}`}
                    variant="titleSmall"
                    tone={item.direction === 'in' ? 'positive' : item.direction === 'none' ? 'muted' : 'default'}
                  />
                </View>
                {index < activity.length - 1 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      </DismissKeyboardView>

      <Portal>
        <Dialog visible={isReserveDialogVisible} onDismiss={() => setReserveDialogVisible(false)}>
          <Dialog.Title>{editingReservationId !== null ? 'Edit Set Aside' : 'Set Aside Money'}</Dialog.Title>
          <Dialog.Content>
            <AppTextInput
              label="Name"
              value={reserveName}
              onChangeText={setReserveName}
              placeholder="BPI Credit Card"
              style={styles.dialogField}
            />

            <AppTextInput
              label="Amount"
              value={reserveAmount}
              onChangeText={setReserveAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
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
                  <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
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

            <Text variant="labelLarge" style={styles.dialogLabel}>
              Category (optional)
            </Text>
            <View style={styles.chipWrap}>
              {RESERVATION_CATEGORIES.map((c) => (
                <Chip key={c} selected={reserveCategory === c} onPress={() => setReserveCategory(c)} mode={reserveCategory === c ? 'flat' : 'outlined'} compact>
                  {c}
                </Chip>
              ))}
            </View>
            <AppTextInput
              label="Or type a custom category"
              value={RESERVATION_CATEGORIES.includes(reserveCategory as (typeof RESERVATION_CATEGORIES)[number]) ? '' : reserveCategory}
              onChangeText={setReserveCategory}
              style={styles.dialogField}
            />

            <View style={styles.chipRow}>
              <Chip selected={hasPlannedDate} onPress={() => setHasPlannedDate((v) => !v)} mode={hasPlannedDate ? 'flat' : 'outlined'}>
                Planned date
              </Chip>
            </View>
            {hasPlannedDate && <DateField value={reservePlannedDate} onChange={setReservePlannedDate} />}

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

        <Dialog visible={isDepositDialogVisible} onDismiss={() => setDepositDialogVisible(false)}>
          <Dialog.Title>Add Money</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
              Increases your actual balance right away - this isn't an expense.
            </Text>
            <AppTextInput
              label="Amount"
              value={depositAmount}
              onChangeText={setDepositAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
              style={[styles.dialogField, styles.amountFieldSpacing]}
            />
            <Text variant="labelLarge" style={styles.dialogLabel}>
              Source
            </Text>
            <View style={styles.chipWrap}>
              {INCOMING_SOURCE_TYPES.map((s) => (
                <Chip key={s.value} selected={depositSourceType === s.value} onPress={() => setDepositSourceType(s.value)} mode={depositSourceType === s.value ? 'flat' : 'outlined'} compact>
                  {s.label}
                </Chip>
              ))}
            </View>
            <AppTextInput
              label="Description (optional)"
              value={depositDescription}
              onChangeText={setDepositDescription}
              placeholder="Bonus"
              style={styles.dialogField}
            />
            {depositError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {depositError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDepositDialogVisible(false)} disabled={isSubmittingDeposit}>
              Cancel
            </Button>
            <Button onPress={handleCreateDeposit} loading={isSubmittingDeposit} disabled={isSubmittingDeposit}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={payingPerson !== null} onDismiss={() => setPayingPerson(null)}>
          <Dialog.Title>{payingPerson?.name} Pays You</Dialog.Title>
          <Dialog.Content>
            <AppTextInput
              label="Amount"
              value={owedPayAmount}
              onChangeText={setOwedPayAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
              style={styles.dialogField}
            />
            <Text variant="labelLarge" style={styles.dialogLabel}>
              Received Via
            </Text>
            <Menu
              visible={isOwedAccountMenuVisible}
              onDismiss={() => setOwedAccountMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setOwedAccountMenuVisible(true)} icon="bank-outline">
                  {owedPaySelectedAccount ? owedPaySelectedAccount.name : 'Select an account'}
                </Button>
              }
            >
              {accounts.concat(account).map((a) => (
                <Menu.Item
                  key={a.id}
                  title={a.name}
                  onPress={() => {
                    setOwedPayAccountId(a.id);
                    setOwedAccountMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
            {owedPayError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {owedPayError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPayingPerson(null)} disabled={isSubmittingOwedPay}>
              Cancel
            </Button>
            <Button onPress={handleRecordOwedPayment} loading={isSubmittingOwedPay} disabled={isSubmittingOwedPay}>
              Record
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isTransferDialogVisible} onDismiss={() => setTransferDialogVisible(false)}>
          <Dialog.Title>Transfer Money</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
              From {account.name} · Available {formatCurrency(account.available)}
            </Text>

            <AppTextInput
              label="Amount"
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
              style={styles.dialogField}
            />

            <Text variant="labelLarge" style={styles.dialogLabel}>
              To
            </Text>
            {accounts.length === 0 ? (
              <Text variant="bodySmall" style={[styles.mutedLabel, { color: theme.colors.onSurfaceVariant }]}>
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

            <AppTextInput
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

      <Snackbar visible={!!flash} onDismiss={() => setFlash(null)} duration={2000}>
        {flash}
      </Snackbar>
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
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  balanceAmount: {
    marginTop: spacing.base,
  },
  mutedLabel: {
    marginTop: 2,
  },
  // A muted version of the onPrimary text color, for secondary labels on
  // the hero card.
  heroMuted: {
    opacity: 0.62,
  },
  summaryDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    opacity: 0.14,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
  },
  summaryCol: {
    alignItems: 'center',
    gap: 2,
  },
  summaryRowSpread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  responsibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.base,
  },
  responsibilityAmount: {
    marginLeft: 'auto',
  },
  negativeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  negativeNoticeText: {
    flex: 1,
  },
  incomingSummary: {
    marginBottom: spacing.xl,
    padding: spacing.base,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flexGrow: 1,
    borderRadius: radii.button,
  },
  section: {
    marginBottom: spacing.xl,
  },
  dayGroup: {
    marginTop: spacing.xs,
  },
  dayLabel: {
    marginBottom: 2,
    marginTop: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  listRowText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  reservationActions: {
    flexDirection: 'row',
  },
  dialogField: {
    marginBottom: spacing.md,
  },
  dialogLabel: {
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: spacing.base,
  },
  purposeButton: {
    marginBottom: spacing.xs,
  },
  amountFieldSpacing: {
    marginTop: spacing.sm,
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
  transferNoteField: {
    marginTop: spacing.md,
  },
});
