import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { IconButton } from 'react-native-paper';

import PeopleScreen from '../screens/PeopleScreen';
import PersonFormScreen from '../screens/PersonFormScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import type { Person } from '../services/personService';
import type { RootTabParamList } from './AppNavigator';

export type PeopleStackParamList = {
  PersonList: undefined;
  PersonForm: { person?: Person } | undefined;
  PersonDetail: { personId: string };
};

const Stack = createNativeStackNavigator<PeopleStackParamList>();

export default function PeopleNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PersonList"
        component={PeopleScreen}
        options={({ navigation }) => ({
          title: 'Money Owed',
          // "Money Owed" is a hidden tab's root screen, so native-stack
          // never gives it a back button on its own (there's nothing before
          // it within THIS stack). It's always reached from another tab, so
          // go back on the parent tab navigator instead - with
          // backBehavior="history" set there, this returns to whichever
          // screen the user actually came from, not a hardcoded Home.
          headerLeft: () => (
            <IconButton
              icon="arrow-left"
              onPress={() => navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.goBack()}
              accessibilityLabel="Back"
            />
          ),
        })}
      />
      <Stack.Screen
        name="PersonForm"
        component={PersonFormScreen}
        options={({ route }) => ({ title: route.params?.person ? 'Edit Person' : 'Add Person' })}
      />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} options={{ title: 'Person Details' }} />
    </Stack.Navigator>
  );
}
