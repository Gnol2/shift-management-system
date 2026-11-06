import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
const Ctx = createContext<(m: string, ok?: boolean) => void>(() => {});
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; ok: boolean } | null>(null);
  const show = useCallback((m: string, ok = true) => { setT({ m, ok }); setTimeout(() => setT(null), 3000); }, []);
  return <Ctx.Provider value={show}>{children}
    {t && <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>{t.m}</div>}</Ctx.Provider>;
}
export const Skeleton = () => <div className="h-24 animate-pulse rounded-xl bg-slate-200" />;
export const Card = ({ label, value }: { label: string; value: string | number }) =>
  <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-3xl font-semibold text-indigo-600">{value}</div></div>;
export const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-400">{text}</div>;
export const btn = 'rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50';
