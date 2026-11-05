import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mail, LogOut, Phone, MapPin, Calendar, User, Users, Building2, KeyRound, Save, ArrowLeft, ShieldAlert, GraduationCap, CalendarCheck, Wallet, ClipboardList } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { fdatetime } from '../lib/format.js';
import { useApi } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Avatar, Badge, Input, Textarea } from '../lib/ui.jsx';
import { useToast } from '../lib/toast.jsx';
import { inr, pct, cap } from '../lib/format.js';

function Security() {
  const toast = useToast(); const { user, logout } = useAuth();
  const everywhere = async () => { try { await api.post('/auth/logout-all'); } catch { /* ignore */ } await logout(); }; const [f, setF] = useState({ current: '', next: '', confirm: '' }); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); if (f.next !== f.confirm) return toast.error('New passwords do not match'); setBusy(true); try { await api.post('/auth/change-password', { current: f.current, next: f.next }); toast('Password updated'); setF({ current: '', next: '', confirm: '' }); } catch (x) { toast.error(x.message); } finally { setBusy(false); } };
  return (<Card title="Security" subtitle="Change your password"><form onSubmit={submit} className="space-y-4"><Input label="Current password" type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
    <div className="grid gap-4 sm:grid-cols-2"><Input label="New password" type="password" autoComplete="new-password" required minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} hint="8+ characters, a letter and a number" /><Input label="Confirm new password" type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
    <button className="btn-primary" disabled={busy}><KeyRound className="h-4 w-4" />Update password</button></form>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><div><p className="text-sm font-semibold text-navy-900">Signed-in sessions</p><p className="text-xs text-slate-500">Last sign-in: {user.lastLogin ? fdatetime(user.lastLogin) : '—'}. Lost a device? Sign out everywhere.</p></div><button className="btn-secondary" onClick={everywhere}><LogOut className="h-4 w-4" />Sign out of all devices</button></div></Card>);
}
const Row = ({ icon: I, label, children }) => (<div className="flex items-start gap-3 py-2.5"><I className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="text-sm text-navy-900">{children || '—'}</p></div></div>);

function StudentProfile({ id, self }) {
  const { isStaff, user } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const { data: s, loading, error, reload } = useApi(`/students/${id}`);
  const [f, setF] = useState(null);
  useEffect(() => { if (s) setF({ phone: s.phone || '', address: s.address || '', dob: s.dob || '', guardian_name: s.guardian_name || '', guardian_phone: s.guardian_phone || '' }); }, [s]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !f) return <Loading />;
  const canEdit = self || user.role === 'admin';
  const save = async (e) => { e.preventDefault(); try { await api.put(`/students/${id}`, f); toast('Profile updated'); reload(); } catch (x) { toast.error(x.message); } };
  return (<>
    {!self && <button className="btn-ghost mb-3 -ml-3" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" />Back</button>}
    <PageHeader title={self ? 'My profile' : 'Student profile'} subtitle="Personal and academic details." />
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-1"><div className="flex flex-col items-center text-center"><Avatar name={s.name} size="h-20 w-20 text-2xl" /><h2 className="mt-3 text-lg font-bold">{s.name}</h2><p className="text-sm text-slate-500">{s.roll_no}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2"><Badge tone="iris">{s.department}</Badge><Badge tone="navy">Year {s.year} · Sem {s.semester}</Badge><Badge tone="slate">Section {s.section}</Badge>{s.open_alerts > 0 && <Badge tone="rose"><ShieldAlert className="h-3 w-3" />{s.open_alerts} alerts</Badge>}</div></div>
        <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100"><Row icon={Mail} label="Email">{s.email}</Row><Row icon={User} label="Username">{s.username}</Row><Row icon={Users} label="Mentors / assigned teachers">{s.teachers.length ? s.teachers.map((t) => t.name).join(', ') : 'Not assigned yet'}</Row></div></Card>
      <div className="space-y-6 xl:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Attendance" value={pct(s.attendance_pct)} icon={CalendarCheck} tone="sky" /><Stat label="Avg marks" value={pct(s.avg_marks)} icon={ClipboardList} tone="navy" /><Stat label="CGPA" value={s.cgpa ?? '—'} icon={GraduationCap} tone="iris" /><Stat label="Pending fees" value={inr(s.pending_fees)} icon={Wallet} tone="amber" /></div>
        <Card title="Personal details" subtitle={canEdit ? 'Keep your contact information up to date.' : 'Read-only'}>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} disabled={!canEdit} /><Input label="Date of birth" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} disabled={!canEdit} />
            <Textarea label="Address" className="sm:col-span-2" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} disabled={!canEdit} />
            <Input label="Guardian name" value={f.guardian_name} onChange={(e) => setF({ ...f, guardian_name: e.target.value })} disabled={!canEdit} /><Input label="Guardian phone" value={f.guardian_phone} onChange={(e) => setF({ ...f, guardian_phone: e.target.value })} disabled={!canEdit} />
            {canEdit && <div className="sm:col-span-2"><button className="btn-primary"><Save className="h-4 w-4" />Save changes</button></div>}</form></Card>
        {self && <Security />}</div></div></>);
}

export default function Profile() {
  const { id } = useParams(); const { user } = useAuth();
  const { data: t } = useApi('/teachers', { skip: user.role !== 'teacher' });
  if (id) return <StudentProfile id={id} />;
  if (user.role === 'student') return <StudentProfile id={user.studentId} self />;
  const me = t?.[0];
  return (<><PageHeader title="Profile & security" subtitle="Your account details." />
    <div className="grid gap-6 xl:grid-cols-3"><Card><div className="flex flex-col items-center text-center"><Avatar name={user.name} size="h-20 w-20 text-2xl" /><h2 className="mt-3 text-lg font-bold">{user.name}</h2><Badge tone="iris" className="mt-2">{cap(user.role)}</Badge></div>
      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100"><Row icon={Mail} label="Email">{user.email}</Row><Row icon={User} label="Username">{user.username}</Row>{me && <><Row icon={Building2} label="Department">{me.department}</Row><Row icon={GraduationCap} label="Designation">{me.designation}</Row><Row icon={Users} label="Assigned students">{me.student_count}</Row></>}</div></Card>
      <div className="xl:col-span-2"><Security /></div></div></>);
}
