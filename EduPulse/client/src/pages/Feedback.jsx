import { useState } from 'react';
import { Send, Trash2, Star, EyeOff, MessageSquare } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { Card, Loading, ErrorState, PageHeader, Empty, Badge, Select, Textarea, RatingStars, Avatar, Tabs, Stat } from '../lib/ui.jsx';
import { BarC } from '../lib/charts.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { ago, cap } from '../lib/format.js';

export default function Feedback() {
  const { user } = useAuth(); const toast = useToast(); const confirm = useConfirm();
  const [tab, setTab] = useState(user.role === 'student' ? 'sent' : 'received');
  const [f, setF] = useState({ target_id: '', rating: 0, anonymous: false, message: '' }); const [busy, setBusy] = useState(false);
  const { data: targets } = useApi(user.role === 'admin' ? null : '/feedback/targets', { skip: user.role === 'admin' });
  const { data: list, loading, error, reload } = useApi('/feedback');
  const { data: sum, reload: reloadSum } = useApi('/feedback/summary');
  const needsRating = user.role === 'student';
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/feedback', { target_id: Number(f.target_id), rating: needsRating ? f.rating : undefined, anonymous: f.anonymous, message: f.message }); toast('Feedback sent'); setF({ target_id: '', rating: 0, anonymous: false, message: '' }); setTab('sent'); reload(); reloadSum(); } catch (x) { toast.error(x.message); } finally { setBusy(false); }
  };
  const del = async (x) => { if (await confirm({ title: 'Delete feedback', message: 'This cannot be undone.', confirmText: 'Delete' })) { try { await api.del(`/feedback/${x.id}`); toast('Feedback deleted'); reload(); reloadSum(); } catch (e) { toast.error(e.message); } } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const shown = (list || []).filter((x) => user.role === 'admin' || (tab === 'sent' ? x.author_id === user.id || (x.author_id === null && false) : x.target_id === user.id));
  const avgAll = sum?.byTeacher?.length ? (sum.byTeacher.reduce((a, b) => a + b.avg * b.n, 0) / sum.byTeacher.reduce((a, b) => a + b.n, 0)) : null;
  return (<>
    <PageHeader title="Feedback" subtitle={user.role === 'student' ? 'Rate your teachers and share suggestions.' : user.role === 'teacher' ? 'Feedback from students and notes you have sent.' : 'All feedback across the institution.'} />
    <div className="grid gap-4 sm:grid-cols-3"><Stat label={user.role === 'student' ? 'Ratings given' : 'Ratings received'} value={sum?.distribution?.reduce((a, b) => a + b.count, 0) ?? 0} icon={MessageSquare} tone="iris" /><Stat label="Average rating" value={avgAll ? avgAll.toFixed(2) : '—'} sub="out of 5" icon={Star} tone="amber" /><Stat label="Total messages" value={list?.length ?? 0} icon={Send} tone="navy" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-1">
        {user.role !== 'admin' && (<Card title={user.role === 'student' ? 'Give feedback to a teacher' : 'Send feedback to a student'}>
          <form onSubmit={submit} className="space-y-4">
            <Select label={user.role === 'student' ? 'Teacher' : 'Student'} required value={f.target_id} onChange={(e) => setF({ ...f, target_id: e.target.value })}><option value="">Select…</option>{targets?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            {needsRating && <div><label className="label">Rating</label><RatingStars value={f.rating} onChange={(n) => setF({ ...f, rating: n })} /></div>}
            <Textarea label="Message" required minLength={3} maxLength={1000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={user.role === 'student' ? 'What is working well? What could improve?' : 'Strengths, areas to improve, encouragement…'} />
            {needsRating && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4 rounded accent-iris-600" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /><EyeOff className="h-4 w-4 text-slate-400" />Send anonymously</label>}
            <button className="btn-primary w-full" disabled={busy || !f.target_id || f.message.length < 3 || (needsRating && !f.rating)}><Send className="h-4 w-4" />Send feedback</button></form></Card>)}
        <Card title="Rating distribution"><BarC data={sum?.distribution?.map((d) => ({ name: `${d.rating}★`, count: d.count })) || []} xKey="name" bars={[{ key: 'count', name: 'Ratings', color: '#f59e0b' }]} unit="" h={200} /></Card>
        {sum?.byTeacher?.length > 0 && user.role !== 'teacher' && <Card title="Teacher ratings"><BarC horizontal data={sum.byTeacher.map((t) => ({ name: t.name.split(' ').slice(-1)[0], avg: t.avg }))} xKey="name" bars={[{ key: 'avg', name: 'Avg rating', color: '#7554dc' }]} domain={[0, 5]} unit="/5" h={Math.max(160, sum.byTeacher.length * 44)} /></Card>}</div>
      <div className="xl:col-span-2">
        {user.role !== 'admin' && <Tabs value={tab} onChange={setTab} tabs={[{ id: 'received', label: 'Received', count: (list || []).filter((x) => x.target_id === user.id).length }, { id: 'sent', label: 'Sent', count: (list || []).filter((x) => x.author_id === user.id).length }]} />}
        <Card pad={false}>{loading && !list ? <Loading /> : !shown.length ? <Empty title="No feedback yet" hint="Messages will appear here." /> : (
          <ul className="divide-y divide-slate-100">{shown.map((x) => { const mine = x.author_id === user.id; return (
            <li key={x.id} className="flex gap-4 p-5"><Avatar name={x.author_name === 'Anonymous' ? 'A N' : x.author_name} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-navy-900">{x.author_name}</p><span className="text-xs text-slate-400">→</span><p className="text-sm font-medium text-slate-600">{x.target_name}</p>{x.anonymous && <Badge tone="slate"><EyeOff className="h-3 w-3" />anonymous</Badge>}<span className="ml-auto text-[11px] text-slate-400">{ago(x.created_at)}</span></div>
                {x.rating && <div className="mt-1"><RatingStars value={x.rating} size="h-4 w-4" /></div>}<p className="mt-2 text-sm text-slate-600">{x.message}</p></div>
              {(mine || user.role === 'admin') && <button className="self-start rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Delete" onClick={() => del(x)}><Trash2 className="h-4 w-4" /></button>}</li>); })}</ul>)}</Card></div></div></>);
}
