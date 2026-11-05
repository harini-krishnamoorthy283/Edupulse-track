import { useState } from 'react';
import { Bell, BellRing, Megaphone, CheckCheck, Trash2, Plus, AlarmClock, Info } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useApi as useA } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Loading, ErrorState, PageHeader, Empty, Modal, Input, Select, Textarea, Chips, SeverityBadge } from '../lib/ui.jsx';
import { useToast } from '../lib/toast.jsx';
import { ago, fdatetime } from '../lib/format.js';

const ICON = { alert: [BellRing, 'bg-rose-50 text-rose-500'], reminder: [AlarmClock, 'bg-amber-50 text-amber-500'], announcement: [Megaphone, 'bg-iris-50 text-iris-500'], info: [Info, 'bg-sky-50 text-sky-500'] };
export default function Notifications() {
  const { user, isStaff } = useAuth(); const toast = useToast();
  const [type, setType] = useState('all'); const [unread, setUnread] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', message: '', type: 'announcement', audience: user.role === 'teacher' ? 'my_students' : 'all', department: '' });
  const { data, loading, error, reload } = useApi('/notifications' + qs({ type, unread: unread ? '1' : '' }));
  const { data: meta } = useA('/meta', { skip: user.role !== 'admin' });
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); reload(); } catch (e) { toast.error(e.message); } };
  const send = () => run(async () => { await api.post('/notifications/announce', { ...f, department: f.audience === 'department' ? f.department : undefined }); setOpen(false); setF({ ...f, title: '', message: '' }); }, 'Announcement sent');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Notifications" subtitle="Alerts, reminders and announcements."
        actions={<><button className="btn-secondary" onClick={() => run(() => api.put('/notifications/read-all'), 'All marked as read')}><CheckCheck className="h-4 w-4" />Mark all read</button>
          {isStaff && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New announcement</button>}</>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Chips value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'alert', label: 'Alerts' }, { value: 'reminder', label: 'Reminders' }, { value: 'announcement', label: 'Announcements' }, { value: 'info', label: 'Updates' }]} />
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} className="h-4 w-4 rounded accent-iris-600" />Unread only {data && <span className="rounded-full bg-iris-100 px-2 text-iris-700">{data.unread}</span>}</label>
      </div>
      <Card pad={false}>{loading && !data ? <Loading /> : data.items.length === 0 ? <Empty title="No notifications" hint="New alerts and announcements will appear here." /> : (
        <ul className="divide-y divide-slate-100">{data.items.map((n) => { const [Ic, tone] = ICON[n.type] || ICON.info; return (
          <li key={n.id} className={`flex gap-4 p-5 ${n.is_read ? '' : 'bg-iris-50/40'}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Ic className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-navy-900">{n.title}</p>{n.severity && <SeverityBadge severity={n.severity} />}{!n.is_read && <span className="h-2 w-2 rounded-full bg-iris-500" />}</div>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{n.message}</p><p className="mt-1 text-[11px] text-slate-400" title={fdatetime(n.created_at)}>{ago(n.created_at)}</p></div>
            <div className="flex shrink-0 items-start gap-1">
              {!n.is_read && <button className="btn-ghost btn-sm" onClick={() => run(() => api.put(`/notifications/${n.id}/read`))}>Mark read</button>}
              <button className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Delete" onClick={() => run(() => api.del(`/notifications/${n.id}`), 'Notification deleted')}><Trash2 className="h-4 w-4" /></button></div>
          </li>); })}</ul>)}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New announcement" footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={f.title.length < 2 || f.message.length < 2} onClick={send}><Megaphone className="h-4 w-4" />Send</button></>}>
        <div className="space-y-4"><Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
          <Textarea label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={1000} />
          <div className="grid gap-4 sm:grid-cols-2"><Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="announcement">Announcement</option><option value="reminder">Reminder</option></Select>
            <Select label="Audience" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              {user.role === 'admin' && <><option value="all">Everyone</option><option value="students">All students</option><option value="teachers">All teachers</option><option value="department">A department</option></>}
              {user.role === 'teacher' && <option value="my_students">My assigned students</option>}</Select></div>
          {f.audience === 'department' && <Select label="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}><option value="">Select…</option>{(meta?.departments || []).map((d) => <option key={d}>{d}</option>)}</Select>}</div>
      </Modal>
    </>
  );
}
