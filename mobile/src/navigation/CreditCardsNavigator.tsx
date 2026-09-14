import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CreditCardsScreen from '../screens/CreditCardsScreen';
import CreditCardFormScreen from '../screens/CreditCardFormScreen';
import CreditCardDetailScreen from '../screens/CreditCardDetailScreen';
import type { CreditCard } from '../api/creditCards';

export type CreditCardsStackParamList = {
  CreditCardList: undefined;
  CreditCardForm: { card?: CreditCard } | undefined;
  CreditCardDetail: { cardId: number };
};

const Stack = createNativeStackNavigator<CreditCardsStackParamList>();

export default function CreditCardsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CreditCardList" component={CreditCardsScreen} options={{ title: 'Credit Cards' }} />
      <Stack.Screen
        name="CreditCardForm"
        component={CreditCardFormScreen}
        options={({ route }) => ({ title: route.params?.card ? 'Edit Card' : 'Add Card' })}
      />
      <Stack.Screen name="CreditCardDetail" component={CreditCardDetailScreen} options={{ title: 'Card Details' }} />
    </Stack.Navigator>
  );
}
