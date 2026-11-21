import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../shared/domain';
import { api, setUnauthorizedHandler } from './data/api';

interface AuthState {
  user: User | null;
  ready: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Holds the signed-in user. The server decides the role; the UI only reflects it. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!api.hasSession()) { setReady(true); return; }
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  const value: AuthState = {
    user, ready,
    async signIn(email, password) { setUser(await api.login(email, password)); },
    async signOut() { try { await api.logout(); } finally { setUser(null); } },
    async changePassword(currentPassword, newPassword) { setUser(await api.changePassword(currentPassword, newPassword)); }
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Loads data for a page and lets it reload after an action. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    load().then(d => { if (live) setData(d); }).catch(e => { if (live) setError((e as Error).message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { data, error, loading, reload: () => setVersion(v => v + 1), setData };
}
