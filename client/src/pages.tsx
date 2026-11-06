import { Link, Navigate } from 'react-router-dom';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { addDays, api, iso, Mine, monday, Shift } from './api';
import { useAuth } from './auth';
import { btn, Card, Empty, Skeleton, useToast } from './ui';

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email) || !pw) return setErr('Enter a valid email and password');
    setBusy(true);
    try { await login(email, pw); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-indigo-600">ShiftHub</h1><p className="text-sm text-slate-500">Sign in to manage duty shifts</p>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <input className="w-full rounded-lg border px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input className="w-full rounded-lg border px-3 py-2 pr-10" placeholder="Password" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-slate-400">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <button disabled={busy} className={`${btn} w-full bg-indigo-600 text-white hover:bg-indigo-700`}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-slate-500">No account? <Link to="/register" className="font-medium text-indigo-600">Create one</Link></p>
      </form>
    </div>);
}

export function Register() {
  const { user, register } = useAuth();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 2 || f.name.includes('@')) return setErr('Name must be at least 2 characters and cannot contain @');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Email is not valid');
    if (f.password.length < 8) return setErr('Password must be at least 8 characters');
    if (f.password !== f.confirm) return setErr('Passwords do not match');
    setBusy(true);
    try { await register(f.name.trim(), f.email.trim(), f.password); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const inp = 'w-full rounded-lg border px-3 py-2';
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-indigo-600">Create account</h1><p className="text-sm text-slate-500">You will sign in with your name</p>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <input className={inp} placeholder="Name (used to sign in)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} placeholder="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={inp} type="password" placeholder="Password (min 8)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input className={inp} type="password" placeholder="Confirm password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        <button disabled={busy} className={`${btn} w-full bg-indigo-600 text-white hover:bg-indigo-700`}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-medium text-indigo-600">Sign in</Link></p>
      </form>
    </div>);
}

export function Dashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState<Shift[] | null>(null); const [mine, setMine] = useState<Mine[] | null>(null);
  useEffect(() => { api<Shift[]>('/shifts?date=' + iso(new Date())).then(setToday).catch(() => {}); api<Mine[]>('/registrations/mine').then(setMine).catch(() => {}); }, []);
  if (!today || !mine) return <div className="grid gap-4 md:grid-cols-3"><Skeleton /><Skeleton /><Skeleton /></div>;
  const upcoming = mine.filter((m) => m.date >= iso(new Date())).slice(0, 5);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome back, {user?.name}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Shifts available today" value={today.filter((s) => s.available > 0).length} />
        <Card label="My registered shifts" value={mine.length} /><Card label="Upcoming" value={upcoming.length} />
      </div>
      <h2 className="font-semibold">Upcoming shifts</h2>
      {upcoming.length ? <div className="space-y-2">{upcoming.map((m) => <div key={m.registrationId} className="rounded-xl border bg-white p-4 text-sm">{m.date} · {m.startTime}–{m.endTime}</div>)}</div> : <Empty text="No upcoming shifts. Pick one in the duty calendar." />}
    </div>);
}

const chip = (s: Shift, mine: boolean) =>
  mine ? 'bg-indigo-100 border-indigo-500 text-indigo-900'
  : s.count >= s.maxUsers ? 'bg-red-50 border-red-400 text-red-800 cursor-not-allowed'
  : s.count > 0 ? 'bg-orange-50 border-orange-400 text-orange-800' : 'bg-emerald-50 border-emerald-400 text-emerald-800';

export function CalendarPage() {
  const { user } = useAuth(); const toast = useToast();
  const [start, setStart] = useState(monday(new Date()));
  const [data, setData] = useState<Record<string, Shift[]>>({}); const [loading, setLoading] = useState(true);
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await Promise.all(days.map((d) => api<Shift[]>('/shifts?date=' + iso(d)))); setData(Object.fromEntries(days.map((d, i) => [iso(d), r[i]]))); }
    catch (e: any) { toast(e.message, false); } finally { setLoading(false); }
  }, [start]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const act = async (s: Shift, mine: boolean) => {
    if (!mine && s.count >= s.maxUsers) return;
    if (mine && !confirm('Cancel your registration for this shift?')) return;
    try { await api(`/shifts/${s.id}/register`, { method: mine ? 'DELETE' : 'POST' }); toast(mine ? 'Registration cancelled' : 'Registered successfully'); }
    catch (e: any) { toast(e.message, false); } finally { load(); }
  };
  const cols = 'grid grid-cols-[90px_repeat(7,1fr)]';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Duty calendar</h1>
        <div className="flex items-center gap-2 text-sm">
          <button className={`${btn} border bg-white`} onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={16} /></button>
          <button className={`${btn} border bg-white`} onClick={() => setStart(monday(new Date()))}>Today</button>
          <span className="rounded-lg border bg-white px-3 py-2">{iso(start)} → {iso(addDays(start, 6))}</span>
          <button className={`${btn} border bg-white`} onClick={() => setStart(addDays(start, 7))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {[['bg-emerald-400', 'Available'], ['bg-orange-400', 'Partially booked'], ['bg-red-400', 'Full'], ['bg-indigo-500', 'My shift']].map(([c, l]) =>
          <span key={l} className="flex items-center gap-1"><i className={`h-3 w-3 rounded ${c}`} />{l}</span>)}
      </div>
      {loading && !Object.keys(data).length ? <Skeleton /> : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><div className="min-w-[960px]">
          <div className={`${cols} border-b bg-slate-50 text-center text-xs font-medium text-slate-500`}>
            <div />{days.map((d) => <div key={iso(d)} className={`p-2 ${iso(d) === iso(new Date()) ? 'text-indigo-600' : ''}`}>{d.toLocaleDateString('en', { weekday: 'short' })}<div className="text-base text-slate-800">{d.getDate()}</div></div>)}
          </div>
          {[...Array(12)].map((_, i) => (
            <div key={i} className={`${cols} border-b last:border-0`}>
              <div className="p-2 text-xs text-slate-500">{String(i * 2).padStart(2, '0')}:00–{i === 11 ? '24' : String(i * 2 + 2).padStart(2, '0')}:00</div>
              {days.map((d) => {
                const s = data[iso(d)]?.[i]; if (!s) return <div key={iso(d)} />;
                const mine = s.registrations.some((r) => r.userId === user?.id);
                return (
                  <div key={s.id} className="p-1">
                    <button onClick={() => act(s, mine)} className={`w-full rounded-lg border-l-4 p-1.5 text-left text-[11px] leading-tight ${chip(s, mine)}`}>
                      <div className="font-semibold">{s.count}/{s.maxUsers}{mine && ' · cancel'}</div>
                      <div className="truncate">{s.registrations.map((r) => r.name).join(', ') || 'Free'}</div>
                    </button>
                  </div>);
              })}
            </div>))}
        </div></div>)}
    </div>);
}

export function MyShifts() {
  const toast = useToast(); const [rows, setRows] = useState<Mine[] | null>(null);
  const load = () => api<Mine[]>('/registrations/mine').then(setRows).catch((e) => toast(e.message, false));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const cancel = async (m: Mine) => {
    if (!confirm('Cancel this registration?')) return;
    try { await api(`/shifts/${m.shiftId}/register`, { method: 'DELETE' }); toast('Registration cancelled'); load(); } catch (e: any) { toast(e.message, false); }
  };
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">My shifts</h1>
      {!rows ? <Skeleton /> : !rows.length ? <Empty text="You have not registered for any shift yet." /> :
        <div className="space-y-2">{rows.map((m) => (
          <div key={m.registrationId} className="flex items-center justify-between rounded-xl border bg-white p-4">
            <div><div className="font-medium">{m.date} · {m.startTime}–{m.endTime}</div>
              <div className="text-sm text-slate-500">Co-workers: {m.coworkers.length ? m.coworkers.join(', ') : 'none yet'}</div></div>
            <button onClick={() => cancel(m)} className={`${btn} border border-red-300 text-red-600 hover:bg-red-50`}>Cancel</button>
          </div>))}</div>}
    </div>);
}
