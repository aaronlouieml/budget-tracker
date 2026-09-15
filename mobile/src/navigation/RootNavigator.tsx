import { NavigationContainer } from '@react-navigation/native';

import { useAppTheme } from '../theme/ThemeContext';
import { navigationDarkTheme, navigationLightTheme } from '../theme/theme';
import AppNavigator from './AppNavigator';

export default function RootNavigator() {
  const { isDark } = useAppTheme();

  return (
    <NavigationContainer theme={isDark ? navigationDarkTheme : navigationLightTheme}>
      <AppNavigator />
    </NavigationContainer>
  );
}
