import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../lib/auth';
import type { AuthUser } from '../lib/types';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  sendRegisterOtp: (input: authApi.SendRegisterOtpInput) => Promise<{ message: string; otpHint?: string }>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!(await authApi.isAuthenticated())) {
      setUser(null);
      return;
    }
    const profile = await authApi.me();
    setUser(profile);
  }, []);

  useEffect(() => {
    refreshProfile()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const sendRegisterOtp = useCallback(async (input: authApi.SendRegisterOtpInput) => {
    return authApi.sendRegisterOtp(input);
  }, []);

  const verifyRegisterOtp = useCallback(
    async (email: string, otp: string) => {
      await authApi.verifyRegisterOtp(email, otp);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, sendRegisterOtp, verifyRegisterOtp, logout, refreshProfile }),
    [user, loading, login, sendRegisterOtp, verifyRegisterOtp, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
