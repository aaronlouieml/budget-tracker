import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { personService } from '../services/personService';
import { ServiceError } from '../services/errors';
import DismissKeyboardView from '../components/DismissKeyboardView';
import type { PeopleStackParamList } from '../navigation/PeopleNavigator';

type Props = NativeStackScreenProps<PeopleStackParamList, 'PersonForm'>;

export default function PersonFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const existing = route.params?.person;
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setApiError(null);
    setIsSubmitting(true);

    try {
      if (isEditing && existing) {
        await personService.updatePerson(existing.id, name.trim());
      } else {
        await personService.createPerson(name.trim());
      }
      navigation.goBack();
    } catch (err) {
      setApiError(err instanceof ServiceError ? err.message : 'Unable to save person. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DismissKeyboardView>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput label="Name" value={name} onChangeText={setName} placeholder="Mau" style={styles.field} />

        {error && (
          <Text style={[styles.error, { color: theme.colors.error }]} variant="bodySmall">
            {error}
          </Text>
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
  error: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 8,
  },
});
