import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getSecureValue, setSecureValue } from '../utils/secureStorage';

const THEME_PREFERENCE_KEY = 'budget_tracker_theme_preference';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    getSecureValue(THEME_PREFERENCE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setIsDark(saved === 'dark');
      }
    });
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      setSecureValue(THEME_PREFERENCE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
