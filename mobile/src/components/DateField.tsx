import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { formatDate } from '../utils/format';
import AppTextInput from './AppTextInput';

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

function toDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DateField({ value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View>
        {/* @react-native-community/datetimepicker has no web implementation; a plain HTML date input keeps this screen usable when previewed on web. */}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 14,
            fontSize: 16,
            borderRadius: 4,
            border: '1px solid #79747E',
            marginBottom: 12,
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <AppTextInput
        label="Date"
        value={formatDate(value)}
        editable={false}
        onPressIn={() => setShowPicker(true)}
        right={<AppTextInput.Icon icon="calendar-outline" onPress={() => setShowPicker(true)} />}
        style={{ marginBottom: 12 }}
      />
      {showPicker && (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_event, selectedDate) => {
            setShowPicker(Platform.OS === 'ios');
            if (selectedDate) {
              onChange(toISODate(selectedDate));
            }
          }}
        />
      )}
    </View>
  );
}
