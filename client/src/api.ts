export type Shift = { id: string; date: string; startTime: string; endTime: string; maxUsers: number; count: number; available: number;
  registrations: { id: string; userId: string; name: string }[] };
export type Mine = { registrationId: string; shiftId: string; date: string; startTime: string; endTime: string; coworkers: string[] };
export type User = { id: string; name: string; email: string; role: 'admin' | 'user'; active: boolean };

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const r = await fetch('/api' + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const j = await r.json().catch(() => ({ success: false, error: 'Network error' }));
  if (!j.success) throw new Error(j.error || 'Request failed');
  return j.data as T;
}
const p2 = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
