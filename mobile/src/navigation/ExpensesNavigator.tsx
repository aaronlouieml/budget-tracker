import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ExpensesScreen from '../screens/ExpensesScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import ReceiptCameraScreen from '../screens/ReceiptCameraScreen';
import type { Expense } from '../services/expenseService';

export interface ScannedReceipt {
  amount: number | null;
  date: string | null;
  merchant: string | null;
  imageBase64: string;
  ocrFailed: boolean;
  ocrError?: string;
}

export type ExpensesStackParamList = {
  ExpenseList: undefined;
  ExpenseForm: { expense?: Expense; scanned?: ScannedReceipt } | undefined;
  ExpenseDetail: { expenseId: string };
  ReceiptCamera: undefined;
};

const Stack = createNativeStackNavigator<ExpensesStackParamList>();

export default function ExpensesNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ExpenseList" component={ExpensesScreen} options={{ title: 'Expenses' }} />
      <Stack.Screen
        name="ExpenseForm"
        component={ExpenseFormScreen}
        options={({ route }) => ({
          title: route.params?.expense ? 'Edit Expense' : route.params?.scanned ? 'Confirm Expense' : 'Add Expense',
        })}
      />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense Details' }} />
      <Stack.Screen name="ReceiptCamera" component={ReceiptCameraScreen} options={{ title: 'Scan Receipt' }} />
    </Stack.Navigator>
  );
}
