import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { logout as authLogout, initSession } from '../services/auth';
import { initMessagesUnread } from '../services/messagesUnread';
import { connectSocket, disconnectSocket } from '../services/socket';

export interface AuthState {
  user: {
    uid: string;
    pseudo: string;
    email?: string;
    staffRole?: 'owner' | 'moderator' | null;
  } | null;
  loading: boolean;
  emailVerified: boolean;
  banned: boolean;
  logout: () => Promise<void>;
  markBanned: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  emailVerified: false,
  banned: false,
  logout: async () => {},
  markBanned: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{
    uid: string;
    pseudo: string;
    email?: string;
    staffRole?: 'owner' | 'moderator' | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [banned, setBanned] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      connectSocket();
      initMessagesUnread();
      const res = await fetch('/api/auth/me');
      if (res.status === 403) {
        setBanned(true);
        setUser(null);
        setEmailVerified(false);
        disconnectSocket();
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Non connecté');
      const profile = await res.json();
      const userData = {
        uid: profile.uid,
        pseudo: profile.pseudo || '',
        email: profile.email,
        staffRole: (profile.staffRole as 'owner' | 'moderator' | null) || null,
      };
      setBanned(false);
      setUser(userData);
      setEmailVerified(!!profile.emailVerified);
      initSession(profile.uid);
    } catch {
      setUser(null);
      setEmailVerified(false);
      disconnectSocket();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    setEmailVerified(false);
    setBanned(false);
    disconnectSocket();
  }, []);

  const markBanned = useCallback(() => {
    setBanned(true);
    setUser(null);
    setEmailVerified(false);
    disconnectSocket();
  }, []);

  const value = useMemo(
    () => ({ user, loading, emailVerified, banned, logout, markBanned, refresh: fetchUser }),
    [user, loading, emailVerified, banned, logout, markBanned, fetchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
