import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AccountsScreen from '../screens/AccountsScreen';
import BankAccountFormScreen from '../screens/BankAccountFormScreen';
import BankAccountDetailScreen from '../screens/BankAccountDetailScreen';
import CreditCardFormScreen from '../screens/CreditCardFormScreen';
import CreditCardDetailScreen from '../screens/CreditCardDetailScreen';
import RecurringPaymentsScreen from '../screens/RecurringPaymentsScreen';
import type { BankAccount } from '../services/bankAccountService';
import type { CreditCard } from '../services/creditCardService';

// Bank accounts and credit cards live in one "Accounts" stack now (they're
// both financial accounts to the user) - only the detail/form screens differ,
// since credit cards need their own fields (due date, responsibility split,
// recurring payments) that a savings/cash/e-wallet account doesn't have.
export type AccountsStackParamList = {
  AccountList: undefined;
  AccountForm: { account?: BankAccount } | undefined;
  AccountDetail: { accountId: string };
  CreditCardForm: { card?: CreditCard } | undefined;
  CreditCardDetail: { cardId: string };
  RecurringPayments: { cardId: string; cardName: string };
};

const Stack = createNativeStackNavigator<AccountsStackParamList>();

export default function AccountsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AccountList" component={AccountsScreen} options={{ title: 'Accounts' }} />
      <Stack.Screen
        name="AccountForm"
        component={BankAccountFormScreen}
        options={({ route }) => ({ title: route.params?.account ? 'Edit Account' : 'Add Account' })}
      />
      <Stack.Screen name="AccountDetail" component={BankAccountDetailScreen} options={{ title: 'Account Details' }} />
      <Stack.Screen
        name="CreditCardForm"
        component={CreditCardFormScreen}
        options={({ route }) => ({ title: route.params?.card ? 'Edit Card' : 'Add Card' })}
      />
      <Stack.Screen name="CreditCardDetail" component={CreditCardDetailScreen} options={{ title: 'Card Details' }} />
      <Stack.Screen
        name="RecurringPayments"
        component={RecurringPaymentsScreen}
        options={({ route }) => ({ title: `${route.params.cardName} · Recurring` })}
      />
    </Stack.Navigator>
  );
}
