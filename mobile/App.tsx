import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { paperDarkTheme, paperLightTheme } from './src/theme/theme';
import { getDb } from './src/database/sqlite';
import RootNavigator from './src/navigation/RootNavigator';

function ThemedApp() {
  const { isDark } = useAppTheme();
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    getDb().then(() => setIsDbReady(true));
  }, []);

  return (
    <PaperProvider theme={isDark ? paperDarkTheme : paperLightTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isDbReady ? (
        <RootNavigator />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <ThemedApp />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
