import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { expenseService, type ExpenseShareInput } from '../services/expenseService';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { bankAccountService, type AccountType, type BankAccount, type Reservation } from '../services/bankAccountService';
import { personService, type Person } from '../services/personService';
import { ServiceError } from '../services/errors';
import { CATEGORIES } from '../constants/expenseOptions';
import { suggestCategory } from '../constants/categorySuggestions';
import { formatCurrency, todayISODate } from '../utils/format';
import { confirmAction } from '../utils/confirm';
import CategoryIcon from '../components/CategoryIcon';
import DateField from '../components/DateField';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import AppTextInput from '../components/AppTextInput';
import OptionRow, { type OptionItem } from '../components/OptionRow';
import { spacing, screenPadding } from '../theme/spacing';
import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseForm'>;

// What a picked account/card means for the stored payment method - the form
// no longer asks for it separately, it follows from where the money comes from.
const PAYMENT_METHOD_FOR_ACCOUNT_TYPE: Record<AccountType, string> = {
  cash: 'cash',
  savings: 'debit_card',
  checking: 'debit_card',
  ewallet: 'ewallet',
};

const ACCOUNT_ICONS: Record<AccountType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  cash: 'cash',
  savings: 'piggy-bank-outline',
  checking: 'bank-outline',
  ewallet: 'cellphone',
};

const NO_ACCOUNT = 'none';

function equalSplit(total: number, otherCount: number) {
  const each = Math.floor((total / (otherCount + 1)) * 100) / 100;
  return { each, mine: total - each * otherCount };
}

export default function ExpenseFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const existing = route.params?.expense;
  const scanned = route.params?.scanned;
  const isEditing = !!existing;

  const [amount, setAmount] = useState(existing ? existing.amount : scanned?.amount != null ? String(scanned.amount) : '');
  const [category, setCategory] = useState(existing?.category ?? suggestCategory(scanned?.merchant) ?? '');
  const [date, setDate] = useState(existing?.date ?? scanned?.date ?? todayISODate());
  const [merchant, setMerchant] = useState(existing?.merchant ?? scanned?.merchant ?? '');
  // 'none' | `account:<id>` | `card:<id>`
  const [payWith, setPayWith] = useState<string>(
    existing?.credit_card_id ? `card:${existing.credit_card_id}` : existing?.bank_account_id ? `account:${existing.bank_account_id}` : NO_ACCOUNT
  );
  const [reservationId, setReservationId] = useState<string | null>(existing?.reservation_id ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const receiptImage = existing?.receipt_image ?? scanned?.imageBase64 ?? null;

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountReservations, setAccountReservations] = useState<Reservation[]>([]);

  const [people, setPeople] = useState<Person[]>([]);
  const [splitIds, setSplitIds] = useState<string[]>([]);
  // null = split equally; otherwise the user's own amounts (text, per person).
  const [customAmounts, setCustomAmounts] = useState<Record<string, string> | null>(null);
  const [customMyShare, setCustomMyShare] = useState('');
  const [isCustomDialogVisible, setCustomDialogVisible] = useState(false);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [draftMyShare, setDraftMyShare] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isAddPersonVisible, setAddPersonVisible] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [addPersonError, setAddPersonError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      creditCardService
        .listCards()
        .then(setCards)
        .catch(() => {
          // Non-critical: the picker just shows no cards.
        });
      bankAccountService
        .listAccounts()
        .then(setAccounts)
        .catch(() => {
          // Non-critical: the picker just shows no accounts.
        });
      personService
        .listPeople()
        .then(setPeople)
        .catch(() => {
          // Non-critical: the split row just shows no people.
        });
    }, [])
  );

  // Existing split shares aren't included in the expense list payload, so fetch
  // the full detail once when editing a split expense to prefill the split.
  useFocusEffect(
    useCallback(() => {
      if (!existing) return;
      expenseService
        .fetchExpense(existing.id)
        .then((detail) => {
          if (detail.shares.length === 0) return;
          const ids = detail.shares.map((s) => s.person_id);
          setSplitIds(ids);
          const total = Number(detail.amount);
          const { each, mine } = equalSplit(total, ids.length);
          const isEqual =
            Math.abs(Number(detail.myShare) - mine) < 0.005 && detail.shares.every((s) => Math.abs(Number(s.amount) - each) < 0.005);
          if (!isEqual) {
            setCustomAmounts(Object.fromEntries(detail.shares.map((s) => [s.person_id, s.amount])));
            setCustomMyShare(detail.myShare);
          }
        })
        .catch(() => {
          // Non-critical: worst case the split isn't prefilled and stays as a plain expense.
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existing?.id])
  );

  const selectedAccountId = payWith.startsWith('account:') ? payWith.slice('account:'.length) : null;
  const selectedCardId = payWith.startsWith('card:') ? payWith.slice('card:'.length) : null;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Set-aside options depend on which account is picked.
  useEffect(() => {
    if (!selectedAccountId) {
      setAccountReservations([]);
      return;
    }
    let cancelled = false;
    bankAccountService
      .fetchAccount(selectedAccountId)
      .then((d) => {
        if (!cancelled) setAccountReservations(d.reservations);
      })
      .catch(() => {
        if (!cancelled) setAccountReservations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  // A set-aside you can pay from: still-active ones, plus the one this very
  // expense already used (so editing it doesn't silently switch funding).
  const reservationOptions = accountReservations.filter((r) => r.status === 'reserved' || r.id === existing?.reservation_id);

  const total = Number(amount) || 0;
  const otherCount = splitIds.length;
  const equal = equalSplit(total, otherCount);
  const shareFor = (personId: string) => (customAmounts ? Number(customAmounts[personId]) || 0 : equal.each);
  const myShare = customAmounts ? Number(customMyShare) || 0 : equal.mine;

  function selectPayWith(next: string) {
    setPayWith(next);
    setReservationId(null);
  }

  function togglePerson(personId: string) {
    setSplitIds((ids) => (ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]));
    // Adding/removing someone goes back to an equal split.
    setCustomAmounts(null);
  }

  function openCustomDialog() {
    setCustomError(null);
    setDraftAmounts(Object.fromEntries(splitIds.map((id) => [id, shareFor(id).toFixed(2)])));
    setDraftMyShare(myShare.toFixed(2));
    setCustomDialogVisible(true);
  }

  function applyCustomAmounts() {
    const sum = splitIds.reduce((acc, id) => acc + (Number(draftAmounts[id]) || 0), 0) + (Number(draftMyShare) || 0);
    if (Math.abs(sum - total) > 0.005) {
      setCustomError(`Amounts add up to ${formatCurrency(sum)} but the expense is ${formatCurrency(total)}`);
      return;
    }
    setCustomAmounts(draftAmounts);
    setCustomMyShare(draftMyShare);
    setCustomDialogVisible(false);
  }

  function resetToEqual() {
    setCustomAmounts(null);
    setCustomMyShare('');
    setCustomDialogVisible(false);
  }

  async function handleAddPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    setAddPersonError(null);
    try {
      const person = await personService.createPerson(name);
      setPeople((prev) => [...prev, person]);
      setSplitIds((ids) => [...ids, person.id]);
      setCustomAmounts(null);
      setNewPersonName('');
      setAddPersonVisible(false);
    } catch (err) {
      setAddPersonError(err instanceof ServiceError ? err.message : 'Unable to add person.');
    }
  }

  function validate(): string[] {
    const problems: string[] = [];
    const amountValue = Number(amount);
    if (!amount) {
      problems.push('Amount is required');
    } else if (Number.isNaN(amountValue) || amountValue <= 0) {
      problems.push('Amount must be a positive number');
    }
    if (!category) {
      problems.push('Category is required');
    }
    if (!date) {
      problems.push('Date is required');
    }
    if (customAmounts) {
      const sum = splitIds.reduce((acc, id) => acc + (Number(customAmounts[id]) || 0), 0) + (Number(customMyShare) || 0);
      if (Math.abs(sum - total) > 0.005) {
        problems.push('The custom split no longer adds up to the amount. Tap "Custom amounts" to fix it, or reset to equal.');
      }
    }
    return problems;
  }

  async function handleSave() {
    const problems = validate();
    setErrors(problems);
    setApiError(null);
    if (problems.length > 0) return;

    const shares: ExpenseShareInput[] | undefined =
      splitIds.length > 0 ? splitIds.map((id) => ({ personId: id, amount: shareFor(id) })) : undefined;

    // The payment method follows from what was picked. With nothing picked
    // an existing expense keeps whatever it already had.
    const paymentMethod = selectedCardId
      ? 'credit_card'
      : selectedAccount
        ? PAYMENT_METHOD_FOR_ACCOUNT_TYPE[selectedAccount.type]
        : existing?.payment_method ?? 'cash';

    setIsSubmitting(true);
    const input = {
      amount: Number(amount),
      category,
      date,
      merchant: merchant.trim() || null,
      payment_method: paymentMethod,
      credit_card_id: selectedCardId,
      bank_account_id: selectedAccountId,
      reservation_id: selectedAccountId ? reservationId : null,
      receipt_image: receiptImage,
      source: scanned ? ('scan' as const) : existing?.source ?? ('manual' as const),
      shares,
    };

    try {
      if (isEditing && existing) {
        await expenseService.updateExpense(existing.id, input);
      } else {
        await expenseService.createExpense(input);
      }
      navigation.goBack();
    } catch (err) {
      setApiError(err instanceof ServiceError ? err.message : 'Unable to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleScanReceipt() {
    const go = () => navigation.replace('ReceiptCamera');
    if (amount || merchant) {
      confirmAction('Scan a receipt instead?', 'What you have entered so far will be replaced by the scan.', 'Scan', go);
    } else {
      go();
    }
  }

  // Tiles ---------------------------------------------------------------

  const categoryItems: OptionItem[] = CATEGORIES.map((c) => ({
    key: c,
    label: c,
    leading: <CategoryIcon category={c} size={40} />,
    selected: category === c,
    onPress: () => setCategory(c),
  }));

  const payItems: OptionItem[] = [
    {
      key: NO_ACCOUNT,
      label: 'No account',
      sublabel: 'Not tracked',
      leading: <MaterialCommunityIcons name="wallet-outline" size={26} color={theme.colors.onSurfaceVariant} />,
      selected: payWith === NO_ACCOUNT,
      onPress: () => selectPayWith(NO_ACCOUNT),
    },
    ...accounts.map((a) => {
      const key = `account:${a.id}`;
      const blocked = Number(a.balance) < 0 && payWith !== key;
      return {
        key,
        label: a.name,
        sublabel: blocked ? 'Negative balance' : `${formatCurrency(a.available)} available`,
        leading: <MaterialCommunityIcons name={ACCOUNT_ICONS[a.type]} size={26} color={theme.colors.primary} />,
        selected: payWith === key,
        disabled: blocked,
        onPress: () => selectPayWith(key),
      };
    }),
    ...cards.map((c) => {
      const key = `card:${c.id}`;
      return {
        key,
        label: c.name,
        sublabel: 'Credit card',
        leading: <MaterialCommunityIcons name="credit-card-outline" size={26} color={theme.colors.primary} />,
        selected: payWith === key,
        onPress: () => selectPayWith(key),
      };
    }),
  ];

  const setAsideItems: OptionItem[] = [
    {
      key: 'available',
      label: 'Available money',
      sublabel: selectedAccount ? formatCurrency(selectedAccount.available) : undefined,
      leading: <MaterialCommunityIcons name="cash-multiple" size={26} color={theme.colors.primary} />,
      selected: reservationId === null,
      onPress: () => setReservationId(null),
    },
    ...reservationOptions.map((r) => ({
      key: r.id,
      label: r.name,
      sublabel: r.status === 'reserved' ? `${formatCurrency(r.amount)} set aside` : 'Used by this expense',
      leading: <MaterialCommunityIcons name="lock-outline" size={26} color={theme.colors.primary} />,
      selected: reservationId === r.id,
      onPress: () => setReservationId(r.id),
    })),
  ];

  const splitItems: OptionItem[] = [
    ...people.map((p) => ({
      key: p.id,
      label: p.name,
      leading: (
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }}>
            {p.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      ),
      selected: splitIds.includes(p.id),
      onPress: () => togglePerson(p.id),
    })),
    {
      key: 'add-person',
      label: 'Add person',
      leading: <MaterialCommunityIcons name="account-plus-outline" size={26} color={theme.colors.primary} />,
      onPress: () => {
        setAddPersonError(null);
        setAddPersonVisible(true);
      },
    },
  ];

  const ocrBannerMessage = !scanned
    ? null
    : scanned.ocrFailed
      ? "Couldn't read this receipt automatically. Please review and fill in the details below."
      : scanned.confidence === 'low'
        ? 'We filled in a best guess from this receipt — please double check the amount, merchant, and date before saving.'
        : null;

  const overAvailable = !!selectedAccount && reservationId === null && total > Number(selectedAccount.available) + 0.005;
  const splitSummary = splitIds
    .map((id) => `${people.find((p) => p.id === id)?.name ?? 'Someone'} ${formatCurrency(shareFor(id))}`)
    .join(' · ');

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DismissKeyboardView>
        <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {ocrBannerMessage && (
            <Text
              variant="bodySmall"
              style={[styles.ocrBanner, { backgroundColor: theme.colors.secondaryContainer, color: theme.colors.onSecondaryContainer }]}
            >
              {ocrBannerMessage}
            </Text>
          )}

          {!isEditing && !scanned && (
            <Button mode="outlined" icon="camera-outline" onPress={handleScanReceipt} style={styles.scanButton} contentStyle={styles.scanButtonContent}>
              Scan receipt instead
            </Button>
          )}

          <AppTextInput
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            inputAccessoryViewID={DONE_ACCESSORY_ID}
            left={<AppTextInput.Affix text="₱" />}
            style={styles.field}
          />

          <Text variant="labelLarge" style={styles.label}>
            Category
          </Text>
          <View style={styles.section}>
            <OptionRow items={categoryItems} />
          </View>

          <Text variant="labelLarge" style={styles.label}>
            Pay with
          </Text>
          <View style={styles.section}>
            <OptionRow items={payItems} />
          </View>

          {selectedAccount && reservationOptions.length > 0 && (
            <>
              <Text variant="labelLarge" style={styles.label}>
                Pay from
              </Text>
              <View style={styles.section}>
                <OptionRow items={setAsideItems} />
              </View>
            </>
          )}

          {overAvailable && (
            <Text variant="bodySmall" style={[styles.hintText, { color: theme.colors.error }]}>
              Only {formatCurrency(selectedAccount!.available)} is available in this account.
              {reservationOptions.length > 0 ? ' Pick a set-aside above, or lower the amount.' : ' Lower the amount or pick another account.'}
            </Text>
          )}

          <Text variant="labelLarge" style={styles.label}>
            Split with
          </Text>
          <View style={styles.section}>
            <OptionRow items={splitItems} />
          </View>
          {splitIds.length > 0 && (
            <View style={styles.splitSummary}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {customAmounts ? 'Custom split' : 'Equal split'}: you {formatCurrency(myShare)} · {splitSummary}
              </Text>
              <Button mode="text" compact onPress={openCustomDialog} style={styles.customButton}>
                Custom amounts
              </Button>
            </View>
          )}

          <Text variant="labelLarge" style={styles.label}>
            Date
          </Text>
          <DateField value={date} onChange={setDate} />

          <AppTextInput label="Merchant (optional)" value={merchant} onChangeText={setMerchant} style={styles.field} />

          {errors.length > 0 && (
            <View style={styles.field}>
              {errors.map((e) => (
                <Text key={e} style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                  {e}
                </Text>
              ))}
            </View>
          )}

          {apiError && (
            <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
              {apiError}
            </Text>
          )}

          <Button mode="contained" onPress={handleSave} loading={isSubmitting} disabled={isSubmitting} style={styles.saveButton} contentStyle={styles.saveButtonContent}>
            Save
          </Button>

          {scanned && (
            <Button mode="outlined" onPress={() => navigation.replace('ReceiptCamera')} disabled={isSubmitting} style={styles.retakeButton}>
              Retake Receipt
            </Button>
          )}
        </ScrollView>
      </DismissKeyboardView>

      <Portal>
        <Dialog visible={isCustomDialogVisible} onDismiss={() => setCustomDialogVisible(false)}>
          <Dialog.Title>Custom amounts</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogHint}>
              Total: {formatCurrency(total)}
            </Text>
            <AppTextInput
              label="Your share"
              value={draftMyShare}
              onChangeText={setDraftMyShare}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
              style={styles.dialogField}
            />
            {splitIds.map((id) => (
              <AppTextInput
                key={id}
                label={people.find((p) => p.id === id)?.name ?? 'Someone'}
                value={draftAmounts[id] ?? ''}
                onChangeText={(text) => setDraftAmounts((prev) => ({ ...prev, [id]: text }))}
                keyboardType="decimal-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                left={<AppTextInput.Affix text="₱" />}
                style={styles.dialogField}
              />
            ))}
            {customError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {customError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={resetToEqual}>Reset to equal</Button>
            <Button onPress={applyCustomAmounts}>Done</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isAddPersonVisible} onDismiss={() => setAddPersonVisible(false)}>
          <Dialog.Title>Add person</Dialog.Title>
          <Dialog.Content>
            <AppTextInput label="Name" value={newPersonName} onChangeText={setNewPersonName} placeholder="Mau" style={styles.dialogField} autoFocus />
            {addPersonError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {addPersonError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddPersonVisible(false)}>Cancel</Button>
            <Button onPress={handleAddPerson} disabled={!newPersonName.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <DoneAccessory />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.base,
    paddingBottom: spacing.xxl,
  },
  field: {
    marginBottom: spacing.base,
  },
  label: {
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  hintText: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  splitSummary: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  customButton: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    marginBottom: spacing.base,
  },
  scanButtonContent: {
    height: 44,
  },
  error: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  saveButtonContent: {
    height: 52,
  },
  retakeButton: {
    marginTop: spacing.md,
  },
  ocrBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  dialogHint: {
    opacity: 0.6,
    marginBottom: spacing.md,
  },
  dialogField: {
    marginBottom: spacing.md,
  },
});
