import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, User } from './api';
type A = { user: User | null; login: (e: string, p: string) => Promise<void>; register: (n: string, e: string, p: string) => Promise<void>; logout: () => void };
const AuthCtx = createContext<A>(null as unknown as A);
export const useAuth = () => useContext(AuthCtx);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('token')) { setReady(true); return; }
    api<User>('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);
  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', r.token); setUser(r.user);
  };
    const register = async (name: string, email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    localStorage.setItem('token', r.token); setUser(r.user);
  };
  const logout = () => { api('/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('token'); setUser(null); };
  return <AuthCtx.Provider value={{ user, login, register, logout }}>{ready ? children : null}</AuthCtx.Provider>;
}
