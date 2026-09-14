import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import ExpensesNavigator from './ExpensesNavigator';
import CreditCardsNavigator from './CreditCardsNavigator';
import BankAccountsNavigator from './BankAccountsNavigator';
import ReportsScreen from '../screens/ReportsScreen';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';

export type RootTabParamList = {
  Home: undefined;
  Expenses: undefined;
  'Credit Cards': undefined;
  Accounts: undefined;
  Reports: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'home',
  Expenses: 'cash-minus',
  'Credit Cards': 'credit-card-outline',
  Accounts: 'bank',
  Reports: 'chart-bar',
};

export default function AppNavigator() {
  const theme = useTheme();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon={isDark ? 'weather-sunny' : 'weather-night'}
              onPress={toggleTheme}
              accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            />
            <IconButton icon="logout" onPress={logout} accessibilityLabel="Log out" />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Expenses" component={ExpensesNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Credit Cards" component={CreditCardsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Accounts" component={BankAccountsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
    </Tab.Navigator>
  );
}
