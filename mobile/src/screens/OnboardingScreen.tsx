import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, List, Text, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { bankAccountService, type AccountType } from '../services/bankAccountService';
import { creditCardService } from '../services/creditCardService';
import { personService } from '../services/personService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES } from '../constants/accountOptions';
import { formatCurrency } from '../utils/format';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import type { HomeStackParamList } from '../navigation/HomeNavigator';

type Props = NativeStackScreenProps<HomeStackParamList, 'Onboarding'>;

const STEP_TITLES = ['Accounts', 'Credit Cards', 'Money Owed', 'Finish'];

export default function OnboardingScreen({ navigation }: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [addedAccounts, setAddedAccounts] = useState<{ id: string; name: string; balance: string }[]>([]);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('savings');
  const [accountBalance, setAccountBalance] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const [addedCards, setAddedCards] = useState<{ id: string; name: string; outstanding: string }[]>([]);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardDueDate, setCardDueDate] = useState('');
  const [cardOutstanding, setCardOutstanding] = useState('');
  const [isAddingCard, setIsAddingCard] = useState(false);

  const [addedPeople, setAddedPeople] = useState<{ id: string; name: string; owed: string }[]>([]);
  const [personName, setPersonName] = useState('');
  const [personOwed, setPersonOwed] = useState('');
  const [isAddingPerson, setIsAddingPerson] = useState(false);

  async function handleAddAccount() {
    setError(null);
    if (!accountName.trim() || !accountBalance) {
      setError('Enter a name and starting balance');
      return;
    }
    setIsAddingAccount(true);
    try {
      const account = await bankAccountService.createAccount({ name: accountName.trim(), type: accountType, balance: Number(accountBalance) });
      setAddedAccounts((prev) => [...prev, { id: account.id, name: account.name, balance: account.balance }]);
      setAccountName('');
      setAccountBalance('');
      setAccountType('savings');
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to add account.');
    } finally {
      setIsAddingAccount(false);
    }
  }

  async function handleAddCard() {
    setError(null);
    const dueDateValue = Number(cardDueDate);
    if (!cardName.trim() || !cardBank.trim() || !Number.isInteger(dueDateValue) || dueDateValue < 1 || dueDateValue > 31) {
      setError('Enter a name, bank, and a due date between 1 and 31');
      return;
    }
    setIsAddingCard(true);
    try {
      const card = await creditCardService.createCard({
        name: cardName.trim(),
        bank: cardBank.trim(),
        dueDate: dueDateValue,
        openingBalance: cardOutstanding ? Number(cardOutstanding) : 0,
      });
      setAddedCards((prev) => [...prev, { id: card.id, name: card.name, outstanding: card.unpaid }]);
      setCardName('');
      setCardBank('');
      setCardDueDate('');
      setCardOutstanding('');
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to add credit card.');
    } finally {
      setIsAddingCard(false);
    }
  }

  async function handleAddPerson() {
    setError(null);
    if (!personName.trim()) {
      setError('Enter a name');
      return;
    }
    setIsAddingPerson(true);
    try {
      const person = await personService.createPerson(personName.trim(), personOwed ? Number(personOwed) : 0);
      setAddedPeople((prev) => [...prev, { id: person.id, name: person.name, owed: person.owesMe }]);
      setPersonName('');
      setPersonOwed('');
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to add person.');
    } finally {
      setIsAddingPerson(false);
    }
  }

  function goToStep(next: number) {
    setError(null);
    setStep(next);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DismissKeyboardView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHeader}>
            <Text variant="labelLarge" style={styles.mutedLabel}>
              Step {step + 1} of {STEP_TITLES.length}
            </Text>
            <Button compact onPress={() => navigation.goBack()}>
              Skip
            </Button>
          </View>
          <Text variant="headlineSmall" style={styles.stepTitle}>
            {STEP_TITLES[step]}
          </Text>

          {step === 0 && (
            <>
              <Text variant="bodyMedium" style={styles.stepIntro}>
                Add your bank accounts, cash, or e-wallets with their current balance.
              </Text>
              <TextInput label="Account Name" value={accountName} onChangeText={setAccountName} style={styles.field} />
              <View style={styles.chipWrap}>
                {ACCOUNT_TYPES.map((t) => (
                  <Chip key={t.value} selected={accountType === t.value} onPress={() => setAccountType(t.value)} mode={accountType === t.value ? 'flat' : 'outlined'}>
                    {t.label}
                  </Chip>
                ))}
              </View>
              <TextInput
                label="Starting Balance"
                value={accountBalance}
                onChangeText={setAccountBalance}
                keyboardType="decimal-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                left={<TextInput.Affix text="₱" />}
                style={styles.field}
              />
              <Button mode="outlined" onPress={handleAddAccount} loading={isAddingAccount} disabled={isAddingAccount} style={styles.addButton}>
                Add Account
              </Button>
              {addedAccounts.map((a) => (
                <List.Item key={a.id} title={a.name} description={formatCurrency(a.balance)} left={(props) => <List.Icon {...props} icon="check-circle-outline" />} />
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <Text variant="bodyMedium" style={styles.stepIntro}>
                Add your credit cards with their current outstanding balance, if any.
              </Text>
              <TextInput label="Card Name" value={cardName} onChangeText={setCardName} placeholder="BDO Visa" style={styles.field} />
              <TextInput label="Bank" value={cardBank} onChangeText={setCardBank} placeholder="BDO" style={styles.field} />
              <TextInput
                label="Due Date (day of month)"
                value={cardDueDate}
                onChangeText={(text) => setCardDueDate(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                placeholder="25"
                maxLength={2}
                style={styles.field}
              />
              <TextInput
                label="Current Outstanding (optional)"
                value={cardOutstanding}
                onChangeText={setCardOutstanding}
                keyboardType="decimal-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                left={<TextInput.Affix text="₱" />}
                style={styles.field}
              />
              <Button mode="outlined" onPress={handleAddCard} loading={isAddingCard} disabled={isAddingCard} style={styles.addButton}>
                Add Credit Card
              </Button>
              {addedCards.map((c) => (
                <List.Item key={c.id} title={c.name} description={formatCurrency(c.outstanding)} left={(props) => <List.Icon {...props} icon="check-circle-outline" />} />
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <Text variant="bodyMedium" style={styles.stepIntro}>
                Add people who owe you money, with any existing balance.
              </Text>
              <TextInput label="Person Name" value={personName} onChangeText={setPersonName} style={styles.field} />
              <TextInput
                label="Existing Balance Owed (optional)"
                value={personOwed}
                onChangeText={setPersonOwed}
                keyboardType="decimal-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                left={<TextInput.Affix text="₱" />}
                style={styles.field}
              />
              <Button mode="outlined" onPress={handleAddPerson} loading={isAddingPerson} disabled={isAddingPerson} style={styles.addButton}>
                Add Person
              </Button>
              {addedPeople.map((p) => (
                <List.Item key={p.id} title={p.name} description={formatCurrency(p.owed)} left={(props) => <List.Icon {...props} icon="check-circle-outline" />} />
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <Text variant="bodyMedium" style={styles.stepIntro}>
                You're all set.
              </Text>
              <List.Item title="Accounts added" description={String(addedAccounts.length)} left={(props) => <List.Icon {...props} icon="bank-outline" />} />
              <List.Item title="Credit cards added" description={String(addedCards.length)} left={(props) => <List.Icon {...props} icon="credit-card-outline" />} />
              <List.Item title="People added" description={String(addedPeople.length)} left={(props) => <List.Icon {...props} icon="account-cash-outline" />} />
            </>
          )}

          {error && (
            <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
              {error}
            </Text>
          )}

          <View style={styles.navRow}>
            {step > 0 && (
              <Button onPress={() => goToStep(step - 1)} icon="chevron-left">
                Back
              </Button>
            )}
            <View style={styles.navSpacer} />
            {step < STEP_TITLES.length - 1 ? (
              <Button mode="contained" onPress={() => goToStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button mode="contained" onPress={() => navigation.goBack()}>
                Go to Home
              </Button>
            )}
          </View>
        </ScrollView>
      </DismissKeyboardView>
      <DoneAccessory />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mutedLabel: {
    opacity: 0.6,
  },
  stepTitle: {
    marginBottom: 4,
  },
  stepIntro: {
    opacity: 0.7,
    marginBottom: 16,
  },
  field: {
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  addButton: {
    marginBottom: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  navSpacer: {
    flex: 1,
  },
  error: {
    marginTop: 8,
  },
});
