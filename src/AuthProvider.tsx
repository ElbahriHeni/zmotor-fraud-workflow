import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import {
  apiGet,
  apiPost,
  clearStoredAccessToken,
  setAccessTokenGetter,
  setStoredAccessToken,
  type CurrentUser,
  type LoginResponse,
} from './api';
import { AUTH_MODE, isAdAuthMode, loginRequest } from './msalConfig';

type LoginCredentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  authMode: string;
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string;
  login: (credentials?: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const isLocalAuthMode = AUTH_MODE === 'local';
const isDevAuthMode = AUTH_MODE === 'dev';

function hasStoredToken() {
  return Boolean(localStorage.getItem('access_token') || sessionStorage.getItem('access_token'));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const msalAuthenticated = useIsAuthenticated();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!isAdAuthMode) return null;

    const account = accounts[0];
    if (!account) return null;

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });

      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect(loginRequest);
        return null;
      }

      throw error;
    }
  }, [accounts, instance]);

  useEffect(() => {
    if (isAdAuthMode) {
      setAccessTokenGetter(getAccessToken);
    } else {
      setAccessTokenGetter(null);
    }

    return () => {
      setAccessTokenGetter(null);
    };
  }, [getAccessToken]);

  const refreshUser = useCallback(async () => {
    try {
      setIsAuthLoading(true);
      setAuthError('');

      if (isAdAuthMode && !accounts[0]) {
        setCurrentUser(null);
        return;
      }

      if (isLocalAuthMode && !hasStoredToken()) {
        setCurrentUser(null);
        return;
      }

      const user = await apiGet<CurrentUser>('/api/auth/me');
      setCurrentUser(user);
    } catch (error) {
      setCurrentUser(null);
      setAuthError(error instanceof Error ? error.message : 'Failed to load current user.');

      if (isLocalAuthMode) {
        clearStoredAccessToken();
      }
    } finally {
      setIsAuthLoading(false);
    }
  }, [accounts]);

  useEffect(() => {
    if (isAdAuthMode) {
      if (inProgress === 'none') {
        refreshUser();
      }
      return;
    }

    refreshUser();
  }, [inProgress, refreshUser]);

  const login = useCallback(
    async (credentials?: LoginCredentials) => {
      setAuthError('');

      if (isAdAuthMode) {
        await instance.loginRedirect(loginRequest);
        return;
      }

      if (isLocalAuthMode) {
        if (!credentials?.email || !credentials.password) {
          throw new Error('Email and password are required.');
        }

        const response = await apiPost<LoginResponse>('/api/auth/login', credentials);
        setStoredAccessToken(response.token);
        setCurrentUser(response.user);
        return;
      }

      if (isDevAuthMode) {
        await refreshUser();
      }
    },
    [instance, refreshUser]
  );

  const logout = useCallback(async () => {
    setCurrentUser(null);
    setAuthError('');
    clearStoredAccessToken();

    if (isAdAuthMode) {
      await instance.logoutRedirect({
        postLogoutRedirectUri: `${window.location.origin}/login`,
      });
    }
  }, [instance]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authMode: AUTH_MODE,
      currentUser,
      isAuthenticated: isAdAuthMode ? msalAuthenticated && Boolean(currentUser) : Boolean(currentUser),
      isAuthLoading,
      authError,
      login,
      logout,
      refreshUser,
      getAccessToken,
    }),
    [authError, currentUser, getAccessToken, isAuthLoading, login, logout, msalAuthenticated, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
