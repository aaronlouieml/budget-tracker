import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as authApi from '../api/auth';
import { getToken, setToken as storeToken, deleteToken } from './tokenStorage';

const TOKEN_KEY = 'budget_tracker_auth_token';

interface AuthContextValue {
  user: authApi.AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<authApi.AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await getToken(TOKEN_KEY);
      if (storedToken) {
        try {
          const me = await authApi.fetchMe(storedToken);
          setToken(storedToken);
          setUser(me);
        } catch {
          await deleteToken(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function handleAuthResponse(response: authApi.AuthResponse) {
    await storeToken(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
  }

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password);
    await handleAuthResponse(response);
  }

  async function register(email: string, password: string) {
    const response = await authApi.register(email, password);
    await handleAuthResponse(response);
  }

  async function logout() {
    await deleteToken(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
