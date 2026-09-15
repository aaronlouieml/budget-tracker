import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PeopleScreen from '../screens/PeopleScreen';
import PersonFormScreen from '../screens/PersonFormScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import type { Person } from '../services/personService';

export type PeopleStackParamList = {
  PersonList: undefined;
  PersonForm: { person?: Person } | undefined;
  PersonDetail: { personId: string };
};

const Stack = createNativeStackNavigator<PeopleStackParamList>();

export default function PeopleNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PersonList" component={PeopleScreen} options={{ title: 'Money Owed' }} />
      <Stack.Screen
        name="PersonForm"
        component={PersonFormScreen}
        options={({ route }) => ({ title: route.params?.person ? 'Edit Person' : 'Add Person' })}
      />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} options={{ title: 'Person Details' }} />
    </Stack.Navigator>
  );
}
