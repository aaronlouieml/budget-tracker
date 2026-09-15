import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Divider, IconButton, List, Menu, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { expenseService, type ExpenseShareInput } from '../services/expenseService';
import { creditCardService, type CreditCard } from '../services/creditCardService';
import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import { personService, type Person } from '../services/personService';
import { ServiceError } from '../services/errors';
import { CATEGORIES, PAYMENT_METHODS } from '../constants/expenseOptions';
import { suggestCategory } from '../constants/categorySuggestions';
import { formatCurrency, todayISODate } from '../utils/format';
import DateField from '../components/DateField';
import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseForm'>;

interface SplitPersonRow {
  personId: string;
  name: string;
  amountText: string;
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
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method ?? 'cash');
  const [creditCardId, setCreditCardId] = useState<string | null>(existing?.credit_card_id ?? null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(existing?.bank_account_id ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const receiptImage = existing?.receipt_image ?? scanned?.imageBase64 ?? null;

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isCardMenuVisible, setCardMenuVisible] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isAccountMenuVisible, setAccountMenuVisible] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [isSplitDialogVisible, setSplitDialogVisible] = useState(false);
  const [myShareText, setMyShareText] = useState('');
  const [splitRows, setSplitRows] = useState<SplitPersonRow[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [isAddPersonVisible, setAddPersonVisible] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  useFocusEffect(
    useCallback(() => {
      creditCardService
        .listCards()
        .then(setCards)
        .catch(() => {
          // Non-critical: the picker just falls back to "no cards" state.
        });
      bankAccountService
        .listAccounts()
        .then(setAccounts)
        .catch(() => {
          // Non-critical: the picker just falls back to "no accounts" state.
        });
      personService
        .listPeople()
        .then(setPeople)
        .catch(() => {
          // Non-critical: the split dialog just falls back to "no people" state.
        });
    }, [])
  );

  // Existing split shares aren't included in the expense list payload, so fetch
  // the full detail once when editing a split expense to prefill the dialog.
  useFocusEffect(
    useCallback(() => {
      if (!existing) return;
      expenseService
        .fetchExpense(existing.id)
        .then((detail) => {
          setMyShareText(detail.myShare);
          setSplitRows(detail.shares.map((s) => ({ personId: s.person_id, name: s.person_name, amountText: s.amount })));
        })
        .catch(() => {
          // Non-critical: worst case the split isn't prefilled and stays as a plain expense.
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existing?.id])
  );

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
    return problems;
  }

  async function handleSave() {
    const problems = validate();
    setErrors(problems);
    setApiError(null);
    if (problems.length > 0) return;

    const shares: ExpenseShareInput[] | undefined =
      splitRows.length > 0
        ? splitRows.map((r) => ({ personId: r.personId, amount: Number(r.amountText) || 0 }))
        : undefined;

    setIsSubmitting(true);
    const input = {
      amount: Number(amount),
      category,
      date,
      merchant: merchant.trim() || null,
      payment_method: paymentMethod || null,
      credit_card_id: paymentMethod === 'credit_card' ? creditCardId : null,
      bank_account_id: paymentMethod !== 'credit_card' ? bankAccountId : null,
      receipt_image: receiptImage,
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

  function recalculateEqualSplit(rows: SplitPersonRow[]) {
    const total = Number(amount) || 0;
    const shareCount = rows.length + 1; // + me
    if (shareCount === 0 || total <= 0) return rows;
    const base = Math.floor((total / shareCount) * 100) / 100;
    const othersTotal = base * rows.length;
    setMyShareText((total - othersTotal).toFixed(2));
    return rows.map((r) => ({ ...r, amountText: base.toFixed(2) }));
  }

  function openSplitDialog() {
    setSplitError(null);
    if (splitRows.length === 0 && !myShareText) {
      // Starting a fresh split: default to an even split with just me for now.
      setMyShareText(amount || '');
    }
    setSplitDialogVisible(true);
  }

  function handleEqualSplit() {
    setSplitRows((rows) => recalculateEqualSplit(rows));
  }

  function addPersonToSplit(person: Person) {
    if (splitRows.some((r) => r.personId === person.id)) return;
    setSplitRows((rows) => recalculateEqualSplit([...rows, { personId: person.id, name: person.name, amountText: '0' }]));
    setAddPersonVisible(false);
  }

  async function handleCreateAndAddPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    try {
      const person = await personService.createPerson(name);
      setPeople((prev) => [...prev, person]);
      setNewPersonName('');
      addPersonToSplit(person);
    } catch (err) {
      setSplitError(err instanceof ServiceError ? err.message : 'Unable to add person.');
    }
  }

  function removePersonFromSplit(personId: string) {
    setSplitRows((rows) => recalculateEqualSplit(rows.filter((r) => r.personId !== personId)));
  }

  function clearSplit() {
    setSplitRows([]);
    setMyShareText('');
    setSplitDialogVisible(false);
  }

  function closeSplitDialog() {
    const total = Number(amount) || 0;
    const splitTotal = splitRows.reduce((sum, r) => sum + (Number(r.amountText) || 0), 0) + (Number(myShareText) || 0);
    if (splitRows.length > 0 && Math.abs(splitTotal - total) > 0.005) {
      setSplitError(`Split total (${formatCurrency(splitTotal)}) must equal the expense total (${formatCurrency(total)})`);
      return;
    }
    setSplitError(null);
    setSplitDialogVisible(false);
  }

  const selectedCard = cards.find((c) => c.id === creditCardId);
  const selectedAccount = accounts.find((a) => a.id === bankAccountId);
  const availablePeople = people.filter((p) => !splitRows.some((r) => r.personId === p.id));
  const splitTotal = splitRows.reduce((sum, r) => sum + (Number(r.amountText) || 0), 0) + (Number(myShareText) || 0);
  const amountValue = Number(amount) || 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {scanned?.ocrFailed && (
        <Text
          variant="bodySmall"
          style={[
            styles.ocrBanner,
            { backgroundColor: theme.colors.secondaryContainer, color: theme.colors.onSecondaryContainer },
          ]}
        >
          Couldn't read this receipt automatically. Please review and fill in the details below.
        </Text>
      )}

      <TextInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        left={<TextInput.Affix text="₱" />}
        style={styles.field}
      />

      <Text variant="labelLarge" style={styles.label}>
        Category
      </Text>
      <View style={styles.chipWrap}>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onPress={() => setCategory(c)} style={styles.chip} mode={category === c ? 'flat' : 'outlined'}>
            {c}
          </Chip>
        ))}
      </View>

      <Text variant="labelLarge" style={styles.label}>
        Date
      </Text>
      <DateField value={date} onChange={setDate} />

      <TextInput label="Merchant (optional)" value={merchant} onChangeText={setMerchant} style={styles.field} />

      <Text variant="labelLarge" style={styles.label}>
        Payment Method
      </Text>
      <View style={styles.chipWrap}>
        {PAYMENT_METHODS.map((m) => (
          <Chip
            key={m.value}
            selected={paymentMethod === m.value}
            onPress={() => setPaymentMethod(m.value)}
            style={styles.chip}
            mode={paymentMethod === m.value ? 'flat' : 'outlined'}
          >
            {m.label}
          </Chip>
        ))}
      </View>

      {paymentMethod === 'credit_card' && (
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>
            Credit Card
          </Text>
          {cards.length === 0 ? (
            <Text variant="bodySmall" style={styles.hint}>
              No credit cards yet. Add one from the Credit Cards tab.
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
                    setCreditCardId(c.id);
                    setCardMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
          )}
        </View>
      )}

      {paymentMethod !== 'credit_card' && (
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>
            Account (optional)
          </Text>
          {accounts.length === 0 ? (
            <Text variant="bodySmall" style={styles.hint}>
              No accounts yet. Add one from the Accounts tab to track this expense against its balance.
            </Text>
          ) : (
            <Menu
              visible={isAccountMenuVisible}
              onDismiss={() => setAccountMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setAccountMenuVisible(true)} icon="bank-outline">
                  {selectedAccount ? selectedAccount.name : 'None selected'}
                </Button>
              }
            >
              <Menu.Item
                title="None"
                onPress={() => {
                  setBankAccountId(null);
                  setAccountMenuVisible(false);
                }}
              />
              {accounts.map((a) => (
                <Menu.Item
                  key={a.id}
                  title={a.name}
                  onPress={() => {
                    setBankAccountId(a.id);
                    setAccountMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
          )}
        </View>
      )}

      <View style={styles.field}>
        {splitRows.length === 0 ? (
          <Button mode="outlined" onPress={openSplitDialog} icon="account-multiple-plus-outline">
            Add Split
          </Button>
        ) : (
          <View>
            <Text variant="labelLarge" style={styles.label}>
              Split Expense
            </Text>
            <Text variant="bodyMedium" style={styles.hint}>
              My Share: {formatCurrency(myShareText || '0')}
            </Text>
            {splitRows.map((r) => (
              <Text key={r.personId} variant="bodyMedium" style={styles.hint}>
                {r.name}: {formatCurrency(r.amountText || '0')}
              </Text>
            ))}
            <Button mode="text" onPress={openSplitDialog} style={styles.editSplitButton}>
              Edit Split
            </Button>
          </View>
        )}
      </View>

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

      <Button mode="contained" onPress={handleSave} loading={isSubmitting} disabled={isSubmitting} style={styles.saveButton}>
        Save
      </Button>

      {scanned && (
        <Button
          mode="outlined"
          onPress={() => navigation.replace('ReceiptCamera')}
          disabled={isSubmitting}
          style={styles.retakeButton}
        >
          Retake Receipt
        </Button>
      )}
    </ScrollView>

    <Portal>
      <Dialog visible={isSplitDialogVisible} onDismiss={closeSplitDialog}>
        <Dialog.Title>Split Expense</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.hint}>
            Total: {formatCurrency(amountValue)}
          </Text>

          <View style={styles.splitModeRow}>
            <Button mode="outlined" compact onPress={handleEqualSplit}>
              Equal Split
            </Button>
          </View>

          <TextInput
            label="My Share"
            value={myShareText}
            onChangeText={setMyShareText}
            keyboardType="decimal-pad"
            left={<TextInput.Affix text="₱" />}
            style={styles.dialogField}
          />

          {splitRows.map((row) => (
            <View key={row.personId} style={styles.splitRow}>
              <TextInput
                label={row.name}
                value={row.amountText}
                onChangeText={(text) => setSplitRows((rows) => rows.map((r) => (r.personId === row.personId ? { ...r, amountText: text } : r)))}
                keyboardType="decimal-pad"
                left={<TextInput.Affix text="₱" />}
                style={styles.splitRowInput}
              />
              <IconButton icon="close" onPress={() => removePersonFromSplit(row.personId)} />
            </View>
          ))}

          <Button mode="text" onPress={() => setAddPersonVisible(true)} icon="plus" style={styles.addPersonButton}>
            Add Person
          </Button>

          <Text
            variant="bodyMedium"
            style={[styles.splitTotalText, { color: Math.abs(splitTotal - amountValue) > 0.005 ? theme.colors.error : undefined }]}
          >
            Split Total: {formatCurrency(splitTotal)} / {formatCurrency(amountValue)}
          </Text>

          {splitError && (
            <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
              {splitError}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={clearSplit}>Remove Split</Button>
          <Button onPress={closeSplitDialog}>Done</Button>
        </Dialog.Actions>
      </Dialog>

      <Dialog visible={isAddPersonVisible} onDismiss={() => setAddPersonVisible(false)}>
        <Dialog.Title>Add Person</Dialog.Title>
        <Dialog.Content>
          {availablePeople.length > 0 && (
            <>
              {availablePeople.map((p, index) => (
                <View key={p.id}>
                  <List.Item title={p.name} onPress={() => addPersonToSplit(p)} />
                  {index < availablePeople.length - 1 && <Divider />}
                </View>
              ))}
              <Divider style={styles.addPersonDivider} />
            </>
          )}
          <TextInput
            label="New person's name"
            value={newPersonName}
            onChangeText={setNewPersonName}
            placeholder="Mau"
            style={styles.dialogField}
          />
          <Button mode="contained" onPress={handleCreateAndAddPerson} disabled={!newPersonName.trim()}>
            Add
          </Button>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setAddPersonVisible(false)}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    marginRight: 0,
  },
  hint: {
    opacity: 0.6,
  },
  editSplitButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  error: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 8,
  },
  retakeButton: {
    marginTop: 12,
  },
  ocrBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  dialogField: {
    marginBottom: 12,
  },
  splitModeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitRowInput: {
    flex: 1,
    marginBottom: 8,
  },
  addPersonButton: {
    alignSelf: 'flex-start',
  },
  addPersonDivider: {
    marginVertical: 8,
  },
  splitTotalText: {
    marginTop: 12,
    fontWeight: '600',
  },
});
