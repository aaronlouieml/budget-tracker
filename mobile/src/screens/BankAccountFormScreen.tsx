import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { bankAccountService, type AccountType } from '../services/bankAccountService';
import { ServiceError } from '../services/errors';
import { ACCOUNT_TYPES } from '../constants/accountOptions';
import type { BankAccountsStackParamList } from '../navigation/BankAccountsNavigator';

type Props = NativeStackScreenProps<BankAccountsStackParamList, 'AccountForm'>;

export default function BankAccountFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const existing = route.params?.account;
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'savings');
  const [balance, setBalance] = useState(existing ? existing.balance : '');
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string[] {
    const problems: string[] = [];
    if (!name.trim()) problems.push('Name is required');
    if (!balance) {
      problems.push('Balance is required');
    } else if (Number.isNaN(Number(balance))) {
      problems.push('Balance must be a number');
    }
    return problems;
  }

  async function handleSave() {
    const problems = validate();
    setErrors(problems);
    setApiError(null);
    if (problems.length > 0) return;

    setIsSubmitting(true);
    const input = { name: name.trim(), type, balance: Number(balance) };

    try {
      if (isEditing && existing) {
        await bankAccountService.updateAccount(existing.id, input);
      } else {
        await bankAccountService.createAccount(input);
      }
      navigation.goBack();
    } catch (err) {
      setApiError(err instanceof ServiceError ? err.message : 'Unable to save account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput label="Account Name" value={name} onChangeText={setName} placeholder="BPI Savings" style={styles.field} />

        <Text variant="labelLarge" style={styles.label}>
          Type
        </Text>
        <View style={styles.chipWrap}>
          {ACCOUNT_TYPES.map((t) => (
            <Chip key={t.value} selected={type === t.value} onPress={() => setType(t.value)} mode={type === t.value ? 'flat' : 'outlined'}>
              {t.label}
            </Chip>
          ))}
        </View>

        <TextInput
          label={isEditing ? 'Current Balance' : 'Starting Balance'}
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="₱" />}
          style={styles.field}
        />

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
  error: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});
