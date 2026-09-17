import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Dialog, FAB, IconButton, Menu, Portal, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import { savedPlanService, type SavedPlan, type SavedPlanInput } from '../services/savedPlanService';
import { bankAccountService, type BankAccount } from '../services/bankAccountService';
import { ServiceError } from '../services/errors';
import { formatCurrency, formatDate, todayISODate } from '../utils/format';
import { confirmDestructive } from '../utils/confirm';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import DateField from '../components/DateField';
import AppTextInput from '../components/AppTextInput';
import EmptyState from '../components/EmptyState';
import AmountText from '../components/AmountText';
import { spacing, screenPadding } from '../theme/spacing';
import { radii } from '../theme/radii';

interface AllocationDraft {
  key: string;
  name: string;
  amount: string;
}

function newAllocation(): AllocationDraft {
  return { key: `${Date.now()}-${Math.random()}`, name: '', amount: '' };
}

export default function SavedPlansScreen() {
  const theme = useTheme();

  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);

  const [isFormVisible, setFormVisible] = useState(false);
  const [name, setName] = useState('');
  const [hasExpectedDate, setHasExpectedDate] = useState(false);
  const [expectedDate, setExpectedDate] = useState(todayISODate());
  const [plannedAmount, setPlannedAmount] = useState('');
  const [note, setNote] = useState('');
  const [allocations, setAllocations] = useState<AllocationDraft[]>([newAllocation()]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [importingPlan, setImportingPlan] = useState<SavedPlan | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [importAccountId, setImportAccountId] = useState<string | null>(null);
  const [importAmount, setImportAmount] = useState('');
  const [importDate, setImportDate] = useState(todayISODate());
  const [isAccountMenuVisible, setAccountMenuVisible] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlans(await savedPlanService.listPlans());
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load saved plans.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      bankAccountService
        .listAccounts()
        .then(setAccounts)
        .catch(() => {
          // Non-critical: the import dialog's account picker just shows "no accounts".
        });
    }, [load])
  );

  function openCreateForm() {
    setName('');
    setHasExpectedDate(false);
    setExpectedDate(todayISODate());
    setPlannedAmount('');
    setNote('');
    setAllocations([newAllocation()]);
    setFormErrors([]);
    setFormVisible(true);
  }

  function updateAllocation(key: string, field: 'name' | 'amount', value: string) {
    setAllocations((prev) => prev.map((a) => (a.key === key ? { ...a, [field]: value } : a)));
  }

  function removeAllocation(key: string) {
    setAllocations((prev) => (prev.length > 1 ? prev.filter((a) => a.key !== key) : prev));
  }

  async function handleSavePlan() {
    const cleanedAllocations = allocations.filter((a) => a.name.trim() || a.amount.trim());
    const input: SavedPlanInput = {
      name: name.trim(),
      expectedDate: hasExpectedDate ? expectedDate : null,
      plannedAmount: plannedAmount ? Number(plannedAmount) : null,
      note: note.trim() || null,
      allocations: cleanedAllocations.map((a) => ({ name: a.name.trim(), amount: Number(a.amount) })),
    };
    setIsSubmitting(true);
    setFormErrors([]);
    try {
      await savedPlanService.createPlan(input);
      setFormVisible(false);
      await load();
    } catch (err) {
      setFormErrors(err instanceof ServiceError ? err.details : ['Unable to save plan.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDelete(plan: SavedPlan) {
    setMenuForId(null);
    confirmDestructive('Delete plan?', `"${plan.name}" will be removed. This does not affect anything already imported.`, 'Delete', async () => {
      await savedPlanService.deletePlan(plan.id);
      await load();
    });
  }

  function openImportDialog(plan: SavedPlan) {
    setMenuForId(null);
    setImportingPlan(plan);
    setImportAccountId(null);
    setImportAmount(plan.planned_amount ?? plan.allocationsTotal);
    setImportDate(todayISODate());
    setImportError(null);
  }

  async function handleConfirmImport() {
    if (!importingPlan) return;
    const amountValue = Number(importAmount);
    if (!importAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      setImportError('Enter a valid amount');
      return;
    }
    if (!importAccountId) {
      setImportError('Select an account to receive the money');
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      await savedPlanService.importPlan(importingPlan.id, { accountId: importAccountId, amount: amountValue, date: importDate });
      setImportingPlan(null);
      await load();
    } catch (err) {
      setImportError(err instanceof ServiceError ? err.message : 'Unable to import plan.');
    } finally {
      setIsImporting(false);
    }
  }

  const selectedImportAccount = accounts.find((a) => a.id === importAccountId);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <DismissKeyboardView>
        <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
          <Text variant="bodyMedium" style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>
            Save a slice for later. Creating a plan doesn't touch your balance — use "Import" once the money actually arrives.
          </Text>
          {error && (
            <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}
          {plans.length === 0 ? (
            <EmptyState
              icon="calendar-clock-outline"
              title="No saved plans yet"
              description="Plan for money you expect later, like a bonus or a refund."
              actionLabel="New Plan"
              onActionPress={openCreateForm}
            />
          ) : (
            plans.map((plan) => (
              <Card key={plan.id} mode="outlined" style={[styles.card, { borderColor: theme.colors.outline }]}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderText}>
                      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                        {plan.name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {plan.expected_date ? `Expected ${formatDate(plan.expected_date)}` : 'No expected date'}
                        {plan.used_at ? ' · Previously imported' : ''}
                      </Text>
                    </View>
                    <Menu
                      visible={menuForId === plan.id}
                      onDismiss={() => setMenuForId(null)}
                      anchor={<IconButton icon="dots-vertical" onPress={() => setMenuForId(plan.id)} />}
                    >
                      <Menu.Item title="Import" leadingIcon="tray-arrow-down" onPress={() => openImportDialog(plan)} />
                      <Menu.Item title="Delete" leadingIcon="delete-outline" onPress={() => handleDelete(plan)} />
                    </Menu>
                  </View>
                  {plan.allocations.length > 0 && (
                    <View style={styles.allocationList}>
                      {plan.allocations.map((a) => (
                        <View key={a.id} style={styles.allocationRow}>
                          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                            {a.name}
                          </Text>
                          <AmountText value={formatCurrency(a.amount)} variant="bodyMedium" tone="muted" />
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.cardFooter}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Allocated {formatCurrency(plan.allocationsTotal)}
                      {plan.planned_amount ? ` of ${formatCurrency(plan.planned_amount)} planned` : ''}
                    </Text>
                    <Button compact onPress={() => openImportDialog(plan)}>
                      Import
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      </DismissKeyboardView>

      <FAB icon="plus" style={[styles.fab, { backgroundColor: theme.colors.primary }]} onPress={openCreateForm} />

      <Portal>
        <Dialog visible={isFormVisible} onDismiss={() => setFormVisible(false)}>
          <Dialog.Title>New Saved Plan</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
              <AppTextInput label="Plan Name" value={name} onChangeText={setName} placeholder="13th Month Pay" style={styles.dialogField} />

              <View style={styles.chipRow}>
                <Chip selected={hasExpectedDate} onPress={() => setHasExpectedDate((v) => !v)} mode={hasExpectedDate ? 'flat' : 'outlined'}>
                  Expected date
                </Chip>
              </View>
              {hasExpectedDate && <DateField value={expectedDate} onChange={setExpectedDate} />}

              <AppTextInput
                label="Planned Amount (optional)"
                value={plannedAmount}
                onChangeText={setPlannedAmount}
                keyboardType="decimal-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                left={<AppTextInput.Affix text="₱" />}
                style={styles.dialogField}
              />

              <Text variant="labelLarge" style={styles.dialogLabel}>
                Allocations (optional)
              </Text>
              {allocations.map((a) => (
                <View key={a.key} style={styles.allocationEditRow}>
                  <AppTextInput label="Name" value={a.name} onChangeText={(v) => updateAllocation(a.key, 'name', v)} style={styles.allocationNameField} dense />
                  <AppTextInput
                    label="Amount"
                    value={a.amount}
                    onChangeText={(v) => updateAllocation(a.key, 'amount', v)}
                    keyboardType="decimal-pad"
                    inputAccessoryViewID={DONE_ACCESSORY_ID}
                    style={styles.allocationAmountField}
                    dense
                  />
                  <IconButton icon="close" size={18} onPress={() => removeAllocation(a.key)} />
                </View>
              ))}
              <Button compact icon="plus" onPress={() => setAllocations((prev) => [...prev, newAllocation()])} style={styles.addAllocationButton}>
                Add allocation
              </Button>

              <AppTextInput label="Note (optional)" value={note} onChangeText={setNote} style={styles.dialogField} />

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
            <Button onPress={handleSavePlan} loading={isSubmitting} disabled={isSubmitting}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={importingPlan !== null} onDismiss={() => setImportingPlan(null)}>
          <Dialog.Title>Import "{importingPlan?.name}"</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.mutedLabel}>
              This increases the account's actual balance and creates real reservations for each allocation.
            </Text>
            <AppTextInput
              label="Amount Received"
              value={importAmount}
              onChangeText={setImportAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              left={<AppTextInput.Affix text="₱" />}
              style={[styles.dialogField, styles.amountFieldSpacing]}
            />
            <Text variant="labelLarge" style={styles.dialogLabel}>
              Into Account
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
                    {selectedImportAccount ? selectedImportAccount.name : 'Select an account'}
                  </Button>
                }
              >
                {accounts.map((a) => (
                  <Menu.Item
                    key={a.id}
                    title={a.name}
                    onPress={() => {
                      setImportAccountId(a.id);
                      setAccountMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
            )}
            <Text variant="labelLarge" style={styles.dialogLabel}>
              Date
            </Text>
            <DateField value={importDate} onChange={setImportDate} />
            {importError && (
              <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
                {importError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setImportingPlan(null)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onPress={handleConfirmImport} loading={isImporting} disabled={isImporting}>
              Import
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
  intro: {
    opacity: 0.7,
    marginBottom: 16,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
  },
  mutedLabel: {
    opacity: 0.6,
  },
  allocationList: {
    marginTop: 8,
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
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
  amountFieldSpacing: {
    marginTop: 8,
  },
  dialogLabel: {
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  allocationEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  allocationNameField: {
    flex: 1.4,
  },
  allocationAmountField: {
    flex: 1,
  },
  addAllocationButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  error: {
    marginBottom: 4,
  },
  errorText: {
    marginBottom: 12,
  },
});
