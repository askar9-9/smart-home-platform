import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api';
import { AUTH_EXPIRED_EVENT, clearToken, getToken, setToken } from '../api/client';
import type { User } from '../api/types';

interface AuthContextValue {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setAuthToken] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleAuthExpired() {
      setAuthToken(null);
      setUser(null);
      queryClient.clear();
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    setUser,
    async login(username, password) {
      const response = await authApi.login(username, password);
      setToken(response.access_token);
      setAuthToken(response.access_token);
      setUser(response.user);
    },
    async logout() {
      try {
        if (token) await authApi.logout();
      } finally {
        clearToken();
        setAuthToken(null);
        setUser(null);
        queryClient.clear();
      }
    }
  }), [queryClient, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
