import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { logout as apiLogout, type CurrentUser, getMe } from '../services/auth';

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* même hors-ligne, on referme la session côté client */
    }
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Une requête a reçu un 401 : la session a expiré ou a été révoquée. */
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('wouaff:unauthorized', onUnauthorized);
    return () => window.removeEventListener('wouaff:unauthorized', onUnauthorized);
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
