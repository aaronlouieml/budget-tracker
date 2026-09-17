import { useState } from 'react';
import { Alert, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IconButton } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import SavedPlansScreen from '../screens/SavedPlansScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useAppTheme } from '../theme/ThemeContext';
import { seedTestData } from '../utils/devSeed';

// Home's own small stack, so its two "reachable but not top-level" flows
// (Saved Plans, the Set Me Up wizard) don't need a place in the tab bar,
// matching the same pattern used for Money Owed off the tab bar.
export type HomeStackParamList = {
  HomeMain: undefined;
  SavedPlans: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
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
    <Stack.Navigator>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{
          title: 'Budget Tracker',
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
        }}
      />
      <Stack.Screen name="SavedPlans" component={SavedPlansScreen} options={{ title: 'Saved Plans' }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Set Me Up' }} />
    </Stack.Navigator>
  );
}
