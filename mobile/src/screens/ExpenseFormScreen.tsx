import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Menu, Text, TextInput, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { createExpense, updateExpense } from '../api/expenses';
import { listCreditCards, type CreditCard } from '../api/creditCards';
import { ApiError } from '../api/client';
import { CATEGORIES, PAYMENT_METHODS } from '../constants/expenseOptions';
import { suggestCategory } from '../constants/categorySuggestions';
import { todayISODate } from '../utils/format';
import DateField from '../components/DateField';
import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseForm'>;

export default function ExpenseFormScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const theme = useTheme();
  const existing = route.params?.expense;
  const scanned = route.params?.scanned;
  const isEditing = !!existing;

  const [amount, setAmount] = useState(existing ? existing.amount : scanned?.amount != null ? String(scanned.amount) : '');
  const [category, setCategory] = useState(existing?.category ?? suggestCategory(scanned?.merchant) ?? '');
  const [date, setDate] = useState(existing?.date ?? scanned?.date ?? todayISODate());
  const [merchant, setMerchant] = useState(existing?.merchant ?? scanned?.merchant ?? '');
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method ?? 'cash');
  const [creditCardId, setCreditCardId] = useState<number | null>(existing?.credit_card_id ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const receiptImage = existing?.receipt_image ?? scanned?.imageBase64 ?? null;

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isCardMenuVisible, setCardMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      listCreditCards(token)
        .then(setCards)
        .catch(() => {
          // Non-critical: the picker just falls back to "no cards" state.
        });
    }, [token])
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
    if (!token) return;

    const problems = validate();
    setErrors(problems);
    setApiError(null);
    if (problems.length > 0) return;

    setIsSubmitting(true);
    const input = {
      amount: Number(amount),
      category,
      date,
      merchant: merchant.trim() || null,
      payment_method: paymentMethod || null,
      credit_card_id: paymentMethod === 'credit_card' ? creditCardId : null,
      receipt_image: receiptImage,
    };

    try {
      if (isEditing && existing) {
        await updateExpense(token, existing.id, input);
      } else {
        await createExpense(token, input);
      }
      navigation.goBack();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Unable to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedCard = cards.find((c) => c.id === creditCardId);

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
});
