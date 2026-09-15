import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BankAccountsScreen from '../screens/BankAccountsScreen';
import BankAccountFormScreen from '../screens/BankAccountFormScreen';
import BankAccountDetailScreen from '../screens/BankAccountDetailScreen';
import type { BankAccount } from '../services/bankAccountService';

export type BankAccountsStackParamList = {
  AccountList: undefined;
  AccountForm: { account?: BankAccount } | undefined;
  AccountDetail: { accountId: string };
};

const Stack = createNativeStackNavigator<BankAccountsStackParamList>();

export default function BankAccountsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AccountList" component={BankAccountsScreen} options={{ title: 'Accounts' }} />
      <Stack.Screen
        name="AccountForm"
        component={BankAccountFormScreen}
        options={({ route }) => ({ title: route.params?.account ? 'Edit Account' : 'Add Account' })}
      />
      <Stack.Screen name="AccountDetail" component={BankAccountDetailScreen} options={{ title: 'Account Details' }} />
    </Stack.Navigator>
  );
}
