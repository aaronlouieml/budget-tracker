import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

import HomeNavigator from './HomeNavigator';
import ExpensesNavigator from './ExpensesNavigator';
import AccountsNavigator from './AccountsNavigator';
import PeopleNavigator from './PeopleNavigator';

// Only 3 tabs are shown in the bar. "Money Owed" stays a real, reachable
// stack (linked to from Home and from account/credit-card screens) - it's
// just not a top-level destination, per the "fewer pages" goal.
export type RootTabParamList = {
  Home: undefined;
  Expenses: undefined;
  Accounts: undefined;
  'Money Owed': undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'home',
  Expenses: 'cash-minus',
  Accounts: 'bank',
  'Money Owed': 'hand-coin-outline',
};

export default function AppNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
        ),
        tabBarActiveTintColor: theme.colors.primary,
      })}
    >
      <Tab.Screen name="Home" component={HomeNavigator} />
      <Tab.Screen name="Expenses" component={ExpensesNavigator} />
      <Tab.Screen name="Accounts" component={AccountsNavigator} />
      <Tab.Screen name="Money Owed" component={PeopleNavigator} options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}
