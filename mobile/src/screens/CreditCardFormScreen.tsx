import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { creditCardService } from '../services/creditCardService';
import { ServiceError } from '../services/errors';
import DismissKeyboardView from '../components/DismissKeyboardView';
import DoneAccessory, { DONE_ACCESSORY_ID } from '../components/DoneAccessory';
import type { AccountsStackParamList } from '../navigation/AccountsNavigator';

type Props = NativeStackScreenProps<AccountsStackParamList, 'CreditCardForm'>;

export default function CreditCardFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const existing = route.params?.card;
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [bank, setBank] = useState(existing?.bank ?? '');
  const [dueDate, setDueDate] = useState(existing ? String(existing.due_date) : '');
  const [openingBalance, setOpeningBalance] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string[] {
    const problems: string[] = [];
    if (!name.trim()) problems.push('Name is required');
    if (!bank.trim()) problems.push('Bank is required');
    const dueDateValue = Number(dueDate);
    if (!dueDate) {
      problems.push('Due date is required');
    } else if (!Number.isInteger(dueDateValue) || dueDateValue < 1 || dueDateValue > 31) {
      problems.push('Due date must be a day of month between 1 and 31');
    }
    return problems;
  }

  async function handleSave() {
    const problems = validate();
    setErrors(problems);
    setApiError(null);
    if (problems.length > 0) return;

    setIsSubmitting(true);
    const input = { name: name.trim(), bank: bank.trim(), dueDate: Number(dueDate), openingBalance: openingBalance ? Number(openingBalance) : 0 };

    try {
      if (isEditing && existing) {
        await creditCardService.updateCard(existing.id, input);
      } else {
        await creditCardService.createCard(input);
      }
      navigation.goBack();
    } catch (err) {
      setApiError(err instanceof ServiceError ? err.message : 'Unable to save credit card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DismissKeyboardView>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput label="Card Name" value={name} onChangeText={setName} placeholder="BDO Visa" style={styles.field} />
        <TextInput label="Bank" value={bank} onChangeText={setBank} placeholder="BDO" style={styles.field} />

        <TextInput
          label="Due Date (day of month)"
          value={dueDate}
          onChangeText={(text) => setDueDate(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          inputAccessoryViewID={DONE_ACCESSORY_ID}
          placeholder="25"
          maxLength={2}
          style={styles.field}
        />
        <HelperText type="info" visible style={styles.helper}>
          Day of the month your statement is due, e.g. 25
        </HelperText>

        {!isEditing && (
          <>
            <TextInput
              label="Current Outstanding (optional)"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              inputAccessoryViewID={DONE_ACCESSORY_ID}
              placeholder="0.00"
              left={<TextInput.Affix text="₱" />}
              style={styles.field}
            />
            <HelperText type="info" visible style={styles.helper}>
              Any balance already on this card, e.g. from before you started using the app
            </HelperText>
          </>
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
  },
  field: {
    marginBottom: 4,
  },
  helper: {
    marginBottom: 12,
  },
  error: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});
