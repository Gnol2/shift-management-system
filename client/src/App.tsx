import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, ListChecks, LogOut, Shield, Users, ClipboardList } from 'lucide-react';
import { useAuth } from './auth';
import { CalendarPage, Dashboard, Login, MyShifts, Register } from './pages';
import { AdminOverview, AdminRegs, AdminUsers } from './admin';

const link = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`;

function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b bg-white p-3 md:w-60 md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 hidden text-lg font-bold text-indigo-600 md:block">ShiftHub</div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          <NavLink to="/" end className={link}><LayoutDashboard size={16} />Dashboard</NavLink>
          <NavLink to="/calendar" className={link}><CalendarDays size={16} />Duty calendar</NavLink>
          <NavLink to="/my" className={link}><ListChecks size={16} />My shifts</NavLink>
          {user?.role === 'admin' && <>
            <NavLink to="/admin" end className={link}><Shield size={16} />Overview</NavLink>
            <NavLink to="/admin/users" className={link}><Users size={16} />Users</NavLink>
            <NavLink to="/admin/registrations" className={link}><ClipboardList size={16} />Registrations</NavLink></>}
          <button onClick={logout} className={link({ isActive: false }) + ' md:mt-6'}><LogOut size={16} />Logout</button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8"><Outlet /></main>
    </div>);
}
function Guard({ admin }: { admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Layout />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Guard />}>
        <Route index element={<Dashboard />} /><Route path="calendar" element={<CalendarPage />} /><Route path="my" element={<MyShifts />} />
      </Route>
      <Route element={<Guard admin />}>
        <Route path="admin" element={<AdminOverview />} /><Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/registrations" element={<AdminRegs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>);
}
