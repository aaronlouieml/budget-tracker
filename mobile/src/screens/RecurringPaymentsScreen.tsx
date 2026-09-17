import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Dialog, Divider, FAB, IconButton, List, Menu, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { recurringPaymentService, type RecurringPayment, type RecurringPaymentInput } from '../services/recurringPaymentService';
import type { RecurringFrequency } from '../repositories/recurringPaymentRepository';
import { ServiceError } from '../services/errors';
import { formatCurrency, formatDate, todayISODate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import DateField from '../components/DateField';
import type { AccountsStackParamList } from '../navigation/AccountsNavigator';

type Props = NativeStackScreenProps<AccountsStackParamList, 'RecurringPayments'>;

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];
const FREQUENCY_LABELS = Object.fromEntries(FREQUENCY_OPTIONS.map((f) => [f.value, f.label]));

export default function RecurringPaymentsScreen({ route }: Props) {
  const theme = useTheme();
  const { cardId } = route.params;

  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);

  const [isFormVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<RecurringPayment | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [nextDate, setNextDate] = useState(todayISODate());
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordDate, setRecordDate] = useState(todayISODate());
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await recurringPaymentService.listForCard(cardId));
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load recurring payments.');
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openCreateForm() {
    setEditing(null);
    setName('');
    setAmount('');
    setFrequency('monthly');
    setNextDate(todayISODate());
    setCategory('');
    setNote('');
    setFormErrors([]);
    setFormVisible(true);
  }

  function openEditForm(item: RecurringPayment) {
    setMenuForId(null);
    setEditing(item);
    setName(item.name);
    setAmount(item.amount);
    setFrequency(item.frequency);
    setNextDate(item.next_date);
    setCategory(item.category ?? '');
    setNote(item.note ?? '');
    setFormErrors([]);
    setFormVisible(true);
  }

  async function handleSaveForm() {
    const input: RecurringPaymentInput = {
      creditCardId: cardId,
      name: name.trim(),
      amount: Number(amount),
      frequency,
      nextDate,
      category: category.trim() || null,
      note: note.trim() || null,
    };
    setIsSubmitting(true);
    setFormErrors([]);
    try {
      if (editing) {
        await recurringPaymentService.update(editing.id, input);
      } else {
        await recurringPaymentService.create(input);
      }
      setFormVisible(false);
      await load();
    } catch (err) {
      setFormErrors(err instanceof ServiceError ? err.details : ['Unable to save recurring payment.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTogglePause(item: RecurringPayment) {
    setMenuForId(null);
    await recurringPaymentService.setActive(item.id, !item.is_active);
    await load();
  }

  function handleDelete(item: RecurringPayment) {
    setMenuForId(null);
    confirmDestructive('Delete recurring payment?', `"${item.name}" will be removed. This does not affect past expenses.`, 'Delete', async () => {
      await recurringPaymentService.delete(item.id);
      await load();
    });
  }

  function openRecordDialog(item: RecurringPayment) {
    setMenuForId(null);
    setRecordingId(item.id);
    setRecordDate(todayISODate());
    setRecordError(null);
  }

  async function handleConfirmRecord() {
    if (!recordingId) return;
    setIsRecording(true);
    setRecordError(null);
    try {
      await recurringPaymentService.recordAsExpense(recordingId, recordDate);
      setRecordingId(null);
      await load();
    } catch (err) {
      setRecordError(err instanceof ServiceError ? err.message : 'Unable to record expense.');
    } finally {
      setIsRecording(false);
    }
  }

  const recordingItem = items.find((i) => i.id === recordingId) ?? null;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <DismissKeyboardView>
        <ScrollView contentContainerStyle={styles.content}>
          {error && (
            <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}
          {items.length === 0 ? (
            <Text variant="bodyMedium" style={styles.emptyText}>
              No recurring payments yet. Add one for a subscription or bill charged to this card.
            </Text>
          ) : (
            items.map((item, index) => (
              <View key={item.id}>
                <List.Item
                  title={item.name}
                  titleStyle={!item.is_active ? styles.pausedText : undefined}
                  description={`${FREQUENCY_LABELS[item.frequency]} · Next ${formatDate(item.next_date)}${item.is_active ? '' : ' · Paused'}`}
                  right={() => (
                    <View style={styles.rowRight}>
                      <Text variant="titleMedium" style={styles.rowAmount}>
                        {formatCurrency(item.amount)}
                      </Text>
                      <Menu
                        visible={menuForId === item.id}
                        onDismiss={() => setMenuForId(null)}
                        anchor={<IconButton icon="dots-vertical" onPress={() => setMenuForId(item.id)} />}
                      >
                        <Menu.Item title="Record as Expense" leadingIcon="cash-check" onPress={() => openRecordDialog(item)} />
                        <Menu.Item title="Edit" leadingIcon="pencil-outline" onPress={() => openEditForm(item)} />
                        <Menu.Item
                          title={item.is_active ? 'Pause' : 'Resume'}
                          leadingIcon={item.is_active ? 'pause' : 'play'}
                          onPress={() => handleTogglePause(item)}
                        />
                        <Menu.Item title="Delete" leadingIcon="delete-outline" onPress={() => handleDelete(item)} />
                      </Menu>
                    </View>
                  )}
                />
                {index < items.length - 1 && <Divider />}
              </View>
            ))
          )}
        </ScrollView>
      </DismissKeyboardView>

      <FAB icon="plus" style={[styles.fab, { backgroundColor: theme.colors.primary }]} onPress={openCreateForm} />

      <Portal>
        <Dialog visible={isFormVisible} onDismiss={() => setFormVisible(false)}>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
              <TextInput label="Name / Merchant" value={name} onChangeText={setName} style={styles.dialogField} />
              <TextInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                left={<TextInput.Affix text="₱" />}
                style={styles.dialogField}
              />
              <Text variant="labelLarge" style={styles.dialogLabel}>
                Frequency
              </Text>
              <View style={styles.chipWrap}>
                {FREQUENCY_OPTIONS.map((f) => (
                  <Chip key={f.value} selected={frequency === f.value} onPress={() => setFrequency(f.value)} mode={frequency === f.value ? 'flat' : 'outlined'}>
                    {f.label}
                  </Chip>
                ))}
              </View>
              <Text variant="labelLarge" style={styles.dialogLabel}>
                Next Payment Date
              </Text>
              <DateField value={nextDate} onChange={setNextDate} />
              <TextInput label="Category (optional)" value={category} onChangeText={setCategory} style={styles.dialogField} />
              <TextInput label="Note (optional)" value={note} onChangeText={setNote} style={styles.dialogField} />
              {formErrors.length > 0 && (
                <View style={styles.dialogField}>
                  {formErrors.map((e) => (
                    <Text key={e} style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                      {e}
                    </Text>
                  ))}
                </View>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setFormVisible(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onPress={handleSaveForm} loading={isSubmitting} disabled={isSubmitting}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={recordingId !== null} onDismiss={() => setRecordingId(null)}>
          <Dialog.Title>Record as Expense</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogField}>
              {recordingItem ? `${recordingItem.name} · ${formatCurrency(recordingItem.amount)}` : ''}
            </Text>
            <Text variant="labelLarge" style={styles.dialogLabel}>
              Charge Date
            </Text>
            <DateField value={recordDate} onChange={setRecordDate} />
            {recordError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {recordError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRecordingId(null)} disabled={isRecording}>
              Cancel
            </Button>
            <Button onPress={handleConfirmRecord} loading={isRecording} disabled={isRecording}>
              Confirm
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
    paddingBottom: 96,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  pausedText: {
    opacity: 0.5,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAmount: {
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
  },
  dialogContent: {
    paddingHorizontal: 24,
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
    marginBottom: 12,
  },
  error: {
    marginBottom: 4,
  },
  errorText: {
    marginBottom: 12,
  },
});
