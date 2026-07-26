import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createAuthApi, createLocalStorageTokenStorage, type AuthApi } from '@traveler-guide/api-client';
import type { AuthUser } from '@traveler-guide/types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

/** Traveler accounts are created in the mobile app; the portal is staff-only. */
const ADMIN_PERMISSION = 'admin:access';

export const ADMIN_ONLY_MESSAGE =
  'This account does not have admin access. Traveler accounts can only sign in on the mobile app.';

function isAdmin(user: AuthUser) {
  return user.permissions.includes(ADMIN_PERMISSION);
}

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  auth: AuthApi;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(
    () => createAuthApi(API_BASE, createLocalStorageTokenStorage('tg_admin_auth')),
    [],
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!(await auth.isAuthenticated())) {
      setUser(null);
      return;
    }
    const profile = await auth.me();
    if (!isAdmin(profile)) {
      await auth.logout();
      setUser(null);
      return;
    }
    setUser(profile);
  }, [auth]);

  useEffect(() => {
    refreshProfile()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      await auth.login({ email, password });
      const profile = await auth.me();

      if (!isAdmin(profile)) {
        await auth.logout();
        setUser(null);
        throw new Error(ADMIN_ONLY_MESSAGE);
      }

      setUser(profile);
    },
    [auth],
  );

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, [auth]);

  const value = useMemo(
    () => ({ user, loading, auth, login, logout, refreshProfile }),
    [user, loading, auth, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
