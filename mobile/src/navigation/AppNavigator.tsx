import { useState } from 'react';
import { Alert, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, useTheme } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import ExpensesNavigator from './ExpensesNavigator';
import CreditCardsNavigator from './CreditCardsNavigator';
import BankAccountsNavigator from './BankAccountsNavigator';
import PeopleNavigator from './PeopleNavigator';
import ReportsScreen from '../screens/ReportsScreen';
import { useAppTheme } from '../theme/ThemeContext';
import { seedTestData } from '../utils/devSeed';

export type RootTabParamList = {
  Home: undefined;
  Expenses: undefined;
  'Credit Cards': undefined;
  Accounts: undefined;
  'Money Owed': undefined;
  Reports: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'home',
  Expenses: 'cash-minus',
  'Credit Cards': 'credit-card-outline',
  Accounts: 'bank',
  'Money Owed': 'hand-coin-outline',
  Reports: 'chart-bar',
};

export default function AppNavigator() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useAppTheme();
  const [isSeeding, setIsSeeding] = useState(false);

  async function handleSeed() {
    setIsSeeding(true);
    try {
      await seedTestData();
      Alert.alert('Test data loaded', 'Existing data was replaced with the spec’s test scenario.');
    } catch (err) {
      Alert.alert('Seed failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            {__DEV__ && (
              <IconButton icon="database-refresh-outline" onPress={handleSeed} loading={isSeeding} accessibilityLabel="Load dev test data" />
            )}
            <IconButton
              icon={isDark ? 'weather-sunny' : 'weather-night'}
              onPress={toggleTheme}
              accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Expenses" component={ExpensesNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Credit Cards" component={CreditCardsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Accounts" component={BankAccountsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Money Owed" component={PeopleNavigator} options={{ headerShown: false, tabBarLabel: 'Owed' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
    </Tab.Navigator>
  );
}
