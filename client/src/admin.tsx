import { FormEvent, useEffect, useState } from 'react';
import { api, User } from './api';
import { btn, Card, Empty, Skeleton, useToast } from './ui';

export function AdminOverview() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <Skeleton />;
  return (
    <div className="space-y-6"><h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Total shifts" value={s.totalShifts} /><Card label="Filled shifts" value={s.filledShifts} /><Card label="Fully booked" value={s.fullShifts} />
        <Card label="Registrations" value={s.totalRegistrations} /><Card label="Active users" value={s.activeUsers} /></div>
      <div className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-semibold">Monthly registrations</h2>
        {Object.entries(s.monthly as Record<string, number>).map(([m, n]) => <div key={m} className="flex justify-between border-b py-1 text-sm last:border-0"><span>{m}</span><b>{n}</b></div>)}
        {!Object.keys(s.monthly).length && <Empty text="No data yet" />}</div>
    </div>);
}

export function AdminUsers() {
  const toast = useToast(); const [users, setUsers] = useState<User[] | null>(null); const [q, setQ] = useState('');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'user' });
  const load = () => api<User[]>('/admin/users?q=' + encodeURIComponent(q)).then(setUsers).catch((e) => toast(e.message, false));
  useEffect(() => { load(); }, [q]); // eslint-disable-line
  const create = async (e: FormEvent) => {
    e.preventDefault();
    try { await api('/admin/users', { method: 'POST', body: JSON.stringify(f) }); toast('User created'); setF({ name: '', email: '', password: '', role: 'user' }); load(); }
    catch (x: any) { toast(x.message, false); }
  };
  const patch = async (id: string, body: object) => { try { await api('/admin/users/' + id, { method: 'PATCH', body: JSON.stringify(body) }); load(); } catch (x: any) { toast(x.message, false); } };
  const inp = 'rounded-lg border px-3 py-2 text-sm';
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Users</h1>
      <form onSubmit={create} className="flex flex-wrap gap-2 rounded-2xl border bg-white p-4">
        <input className={inp} placeholder="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} placeholder="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={inp} placeholder="Password (min 8)" type="password" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <select className={inp} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option>user</option><option>admin</option></select>
        <button className={`${btn} bg-indigo-600 text-white`}>Create user</button></form>
      <input className={`${inp} w-full max-w-xs`} placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!users ? <Skeleton /> : !users.length ? <Empty text="No users found" /> :
        <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} className="border-t"><td className="p-3 font-medium">{u.name}</td><td>{u.email}</td>
              <td><select className="rounded border px-2 py-1" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}><option>user</option><option>admin</option></select></td>
              <td><button onClick={() => patch(u.id, { active: !u.active })} className={`${btn} ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{u.active ? 'Active' : 'Inactive'}</button></td></tr>))}
          </tbody></table></div>}
    </div>);
}

export function AdminRegs() {
  const toast = useToast(); const [date, setDate] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => api<any[]>('/admin/registrations' + (date ? '?date=' + date : '')).then(setRows).catch((e) => toast(e.message, false));
  useEffect(() => { load(); }, [date]); // eslint-disable-line
  const del = async (id: string) => {
    if (!confirm('Remove this registration?')) return;
    try { await api('/admin/registrations/' + id, { method: 'DELETE' }); toast('Registration removed'); load(); } catch (e: any) { toast(e.message, false); }
  };
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Registrations</h1>
      <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
      {!rows ? <Skeleton /> : !rows.length ? <Empty text="No registrations" /> :
        <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Date</th><th>Shift</th><th>User</th><th /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{r.date}</td><td>{r.startTime}–{r.endTime}</td><td>{r.userName}</td>
            <td><button onClick={() => del(r.id)} className={`${btn} text-red-600 hover:bg-red-50`}>Remove</button></td></tr>)}</tbody></table></div>}
    </div>);
}
