import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

import HomeNavigator from './HomeNavigator';
import ExpensesNavigator, { type ExpensesStackParamList } from './ExpensesNavigator';
import AccountsNavigator from './AccountsNavigator';
import PeopleNavigator from './PeopleNavigator';
import { radii } from '../theme/radii';

// Only 3 tabs are shown in the bar. "Money Owed" stays a real, reachable
// stack (linked to from Home and from account/credit-card screens) - it's
// just not a top-level destination, per the "fewer pages" goal.
export type RootTabParamList = {
  Home: undefined;
  // Nested so Home can open the Add Expense form directly.
  Expenses: NavigatorScreenParams<ExpensesStackParamList> | undefined;
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
      // 'history' (rather than the default 'firstRoute') makes goBack() on
      // this navigator return to whichever tab was actually focused before -
      // required so the hidden "Money Owed" tab's back button returns to the
      // real previous screen instead of always jumping to Home.
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        // A soft pastel pill behind the active tab's icon, rather than
        // tinting the icon alone - reads clearly as "selected" without
        // needing a strong/dark color.
        tabBarIcon: ({ color, size, focused }) => (
          <View style={[styles.iconWrap, focused && { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name={ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
          </View>
        ),
        tabBarActiveTintColor: theme.colors.onPrimaryContainer,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant },
      })}
    >
      <Tab.Screen name="Home" component={HomeNavigator} />
      <Tab.Screen name="Expenses" component={ExpensesNavigator} />
      <Tab.Screen name="Accounts" component={AccountsNavigator} />
      <Tab.Screen
        name="Money Owed"
        component={PeopleNavigator}
        options={{
          tabBarButton: () => null,
          // Without this, the hidden tab still reserves an equal flex share
          // of the bar's width (it just renders nothing inside it), which
          // pushes the 3 visible tabs off-center. Zeroing its width lets the
          // remaining flex:1 items share the full bar evenly.
          tabBarItemStyle: styles.hiddenTabItem,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  hiddenTabItem: {
    flex: 0,
    width: 0,
    minWidth: 0,
    padding: 0,
    margin: 0,
  },
});
