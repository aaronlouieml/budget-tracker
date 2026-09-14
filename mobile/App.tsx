import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthContext';
import { AppThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { paperDarkTheme, paperLightTheme } from './src/theme/theme';
import RootNavigator from './src/navigation/RootNavigator';

function ThemedApp() {
  const { isDark } = useAppTheme();

  return (
    <PaperProvider theme={isDark ? paperDarkTheme : paperLightTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
