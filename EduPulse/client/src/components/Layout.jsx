import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileBarChart, CalendarCheck, ClipboardList, TrendingUp, Trophy, MessageSquareText, GraduationCap, Wallet, BookOpenCheck, Bell, UserCircle, ShieldAlert, Users, Settings2, Menu, LogOut, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';
import { onChange, useLiveStatus } from '../lib/live.js';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { Avatar, Badge } from '../lib/ui.jsx';
import { ago, cap } from '../lib/format.js';

const NAV = [
  { group: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/early-warning', label: 'Early Warning', icon: ShieldAlert },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  ] },
  { group: 'Academics', items: [
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/marks', label: 'Marks', icon: ClipboardList },
    { to: '/performance', label: 'Performance', icon: TrendingUp },
    { to: '/results', label: 'Results', icon: GraduationCap },
    { to: '/reports', label: 'Reports', icon: FileBarChart },
    { to: '/missed-courses', label: 'Missed Courses', icon: BookOpenCheck },
  ] },
  { group: 'Campus', items: [
    { to: '/fees', label: 'Fees', icon: Wallet },
    { to: '/extracurricular', label: 'Extracurricular', icon: Trophy },
    { to: '/feedback', label: 'Feedback', icon: MessageSquareText },
  ] },
  { group: 'Manage', items: [
    { to: '/students', label: 'Students', icon: Users, roles: ['admin', 'teacher'] },
    { to: '/admin', label: 'Administration', icon: Settings2, roles: ['admin'] },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ] },
];
const TITLES = { '/dashboard': 'Dashboard', '/early-warning': 'Early Warning', '/notifications': 'Notifications', '/attendance': 'Attendance', '/marks': 'Marks', '/performance': 'Performance', '/results': 'Results', '/reports': 'Reports', '/missed-courses': 'Missed Courses', '/fees': 'Fees', '/extracurricular': 'Extracurricular', '/feedback': 'Feedback', '/students': 'Students', '/admin': 'Administration', '/profile': 'Profile' };

export const Logo = ({ dark }) => (
  <div className="flex items-center gap-2.5">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-iris-500 to-navy-500 shadow-lg shadow-iris-500/30">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 5v14M7 12l9-7M7 12l9 7" /></svg></span>
    <div className="leading-tight"><p className={`text-[17px] font-bold tracking-tight ${dark ? 'text-white' : 'text-navy-900'}`}>EduPulse</p><p className={`text-[10px] font-medium uppercase tracking-[0.14em] ${dark ? 'text-navy-300' : 'text-slate-400'}`}>Student Monitoring</p></div>
  </div>
);

function Bell_({ unread, onGo }) {
  const [open, setOpen] = useState(false);
  const { data, reload } = useApi(open ? '/notifications' : null, { skip: !open });
  const ref = useRef();
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Notifications">
        <Bell className="h-[18px] w-[18px]" />{unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}</button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><p className="text-sm font-semibold text-navy-900">Notifications</p>
            <button className="text-xs font-semibold text-iris-600" onClick={async () => { await api.put('/notifications/read-all'); reload(); onGo.refresh(); }}>Mark all read</button></div>
          <div className="max-h-96 overflow-y-auto">{(data?.items || []).slice(0, 8).map((n) => (
            <button key={n.id} onClick={async () => { if (!n.is_read) await api.put(`/notifications/${n.id}/read`); setOpen(false); onGo.refresh(); onGo.nav(n.link || '/notifications'); }}
              className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.is_read ? '' : 'bg-iris-50/40'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-iris-500'}`} />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-navy-800">{n.title}</span><span className="line-clamp-2 text-xs text-slate-500">{n.message}</span><span className="text-[10px] text-slate-400">{ago(n.created_at)}</span></span></button>))}
            {data && !data.items.length && <p className="p-6 text-center text-sm text-slate-400">You're all caught up</p>}</div>
          <button onClick={() => { setOpen(false); onGo.nav('/notifications'); }} className="w-full border-t border-slate-100 py-3 text-xs font-semibold text-navy-700 hover:bg-slate-50">View all notifications</button>
        </div>)}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef();
  const toast = useToast(); const live = useLiveStatus(); const prevUnread = useRef(null);
  const refresh = () => api.get('/notifications?unread=1').then((r) => { if (prevUnread.current !== null && r.unread > prevUnread.current) toast('You have a new notification'); prevUnread.current = r.unread; setUnread(r.unread); }).catch(() => {});
  useEffect(() => { refresh(); const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [loc.pathname]);
  useEffect(() => onChange(() => refresh()), []);
  useEffect(() => setMobile(false), [loc.pathname]);
  useEffect(() => { const h = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith('/students/') ? 'Student Profile' : 'EduPulse');

  const sidebar = (
    <div className="flex h-full w-72 flex-col bg-gradient-to-b from-navy-900 to-navy-950 text-navy-100">
      <div className="flex items-center justify-between px-6 pb-5 pt-6"><Logo dark /><button className="rounded-lg p-1 text-navy-300 lg:hidden" onClick={() => setMobile(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => { const items = g.items.filter((i) => !i.roles || i.roles.includes(user.role)); if (!items.length) return null;
          return (<div key={g.group}><p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">{g.group}</p>
            {items.map(({ to, label, icon: Icon, badge }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white'}`}>
                {({ isActive }) => (<>{isActive && <span className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-iris-400" />}
                  <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-iris-300' : 'text-navy-300 group-hover:text-iris-300'}`} />
                  <span className="flex-1">{label === 'Profile' && user.role === 'student' ? 'My Profile' : label}</span>
                  {badge && unread > 0 && <span className="rounded-full bg-iris-500 px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>}</>)}
              </NavLink>))}</div>); })}
      </nav>
      <div className="m-3 rounded-2xl bg-white/5 p-3">
        <div className="flex items-center gap-3"><Avatar name={user.name} tone="bg-iris-400/20 text-iris-200" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="text-[11px] text-navy-300">{cap(user.role)}</p></div>
          <button onClick={logout} className="rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white" aria-label="Log out" title="Log out"><LogOut className="h-4 w-4" /></button></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</aside>
      {mobile && (<div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobile(false)} /><div className="absolute inset-y-0 left-0">{sidebar}</div></div>)}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur sm:px-8">
        <button className="rounded-xl border border-slate-200 p-2.5 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <p className="text-sm font-semibold text-navy-800 lg:text-base">{title}</p>
        <div className="ml-auto flex items-center gap-3">
          <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`} title={live ? 'Real-time updates are on' : 'Reconnecting…'}><span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />{live ? 'Live' : 'Offline'}</span>
          <Badge tone="iris" className="hidden sm:inline-flex">{cap(user.role)}</Badge>
          <Bell_ unread={unread} onGo={{ nav, refresh }} />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 hover:bg-slate-50"><Avatar name={user.name} size="h-8 w-8 text-[11px]" /><span className="hidden max-w-[120px] truncate text-sm font-semibold text-navy-800 sm:block">{user.name}</span><ChevronDown className="h-4 w-4 text-slate-400" /></button>
            {menu && (<div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-pop">
              <div className="border-b border-slate-100 px-4 py-3"><p className="truncate text-sm font-semibold text-navy-900">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
              <button className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenu(false); nav('/profile'); }}><UserCircle className="h-4 w-4" />Profile & security</button>
              <button className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50" onClick={logout}><LogOut className="h-4 w-4" />Log out</button></div>)}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8"><Outlet /></main>
    </div>
  );
}
