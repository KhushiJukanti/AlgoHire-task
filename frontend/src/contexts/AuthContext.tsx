import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearStoredSession,
  demoLogin as apiDemoLogin,
  fetchCurrentUser,
  getStoredToken,
  getStoredUser,
  loginWithPassword,
  registerUnauthorizedHandler,
  setStoredSession,
} from '@/src/lib/api';
import type { CanonicalRole, User } from '@/src/types/certiflow';
import { normalizeRole } from '@/src/lib/utils';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  canonicalRole: CanonicalRole | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  login: (email: string, password: string) => Promise<User>;
  loginDemo: (email: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isInitializing, setIsInitializing] = useState<boolean>(() => Boolean(getStoredToken()));
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const resetPrivateCache = useCallback(() => {
    queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  const handleUnauthorized = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    resetPrivateCache();
    setSessionExpiredMessage('Your session expired or is no longer valid. Please sign in again.');
  }, [resetPrivateCache]);

  useEffect(() => {
    return registerUnauthorizedHandler(handleUnauthorized);
  }, [handleUnauthorized]);

  useEffect(() => {
    let active = true;
    const existingToken = getStoredToken();
    if (!existingToken) {
      setIsInitializing(false);
      return;
    }

    fetchCurrentUser()
      .then((me) => {
        if (!active) return;
        setStoredSession(existingToken, me);
        setToken(existingToken);
        setUser(me);
      })
      .catch((err) => {
        if (!active) return;
        // Only clear session if backend explicitly rejected auth (401/403),
        // not if backend is temporarily unreachable so user sees the connectivity message
        if (err && typeof err.status === 'number' && (err.status === 401 || err.status === 403)) {
          clearStoredSession();
          setToken(null);
          setUser(null);
          resetPrivateCache();
        }
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
    };
  }, [resetPrivateCache]);

  const applySession = useCallback(
    (nextToken: string, nextUser: User) => {
      // Clear any previous user's cached query data before activating the new session
      resetPrivateCache();
      setStoredSession(nextToken, nextUser);
      setToken(nextToken);
      setUser(nextUser);
      setSessionExpiredMessage(null);
    },
    [resetPrivateCache]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginWithPassword(email, password);
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const loginDemo = useCallback(
    async (email: string) => {
      const res = await apiDemoLogin(email);
      applySession(res.token, res.user);
      return res.user;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    setSessionExpiredMessage(null);
    resetPrivateCache();
  }, [resetPrivateCache]);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        canonicalRole: normalizeRole(user?.role),
        isAuthenticated: Boolean(token && user),
        isInitializing,
        sessionExpiredMessage,
        clearSessionExpiredMessage,
        login,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
