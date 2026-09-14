import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { navigationDarkTheme, navigationLightTheme } from '../theme/theme';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { isDark } = useAppTheme();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={isDark ? navigationDarkTheme : navigationLightTheme}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
