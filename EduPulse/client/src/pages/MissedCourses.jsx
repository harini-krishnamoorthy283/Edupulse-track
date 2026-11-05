import { useState } from 'react';
import { BookOpenCheck, Video, FileText, CheckCircle2, Circle, Plus, Pencil, Trash2, Library, StickyNote, ExternalLink } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Badge, StudentSelect, Modal, Input, Select, Textarea, Tabs, Progress, FilterSelect, TableWrap } from '../lib/ui.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { fdate, today } from '../lib/format.js';

const LessonCard = ({ l, student, onReview }) => (
  <div className={`card p-5 ${l.reviewed ? 'opacity-80' : ''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone="navy">{l.code}</Badge><span className="text-xs text-slate-400">{fdate(l.lesson_date)}</span>{l.missed && <Badge tone="rose">Missed</Badge>}</div>
    <p className="mt-2 font-semibold text-navy-900">{l.topic}</p><p className="text-xs text-slate-500">{l.subject}</p></div>
    {student && <button onClick={() => onReview(l)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${l.reviewed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-iris-50 hover:text-iris-700'}`}>{l.reviewed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{l.reviewed ? 'Reviewed' : 'Mark reviewed'}</button>}</div>
    {l.notes && <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{l.notes}</p>}
    <div className="mt-3 flex flex-wrap gap-2">{l.video_url && <a href={l.video_url} target="_blank" rel="noreferrer noopener" className="btn-secondary btn-sm"><Video className="h-3.5 w-3.5 text-rose-500" />Recorded lesson<ExternalLink className="h-3 w-3 text-slate-400" /></a>}{l.resource_url && <a href={l.resource_url} target="_blank" rel="noreferrer noopener" className="btn-secondary btn-sm"><FileText className="h-3.5 w-3.5 text-iris-500" />Learning resources<ExternalLink className="h-3 w-3 text-slate-400" /></a>}</div></div>
);

export default function MissedCourses() {
  const { user, isStaff } = useAuth(); const toast = useToast(); const confirm = useConfirm();
  const student = user.role === 'student';
  const [tab, setTab] = useState(student ? 'missed' : 'summary'); const [sid, setSid] = useState(''); const [status, setStatus] = useState(''); const [subj, setSubj] = useState(''); const [form, setForm] = useState(null);
  const { data: students } = useStudents(isStaff);
  const { data: subjects } = useApi(user.role === 'teacher' ? '/subjects?mine=1' : '/subjects');
  const { data: missed, loading, error, reload } = useApi('/lessons/missed' + qs({ student_id: sid }), { skip: tab !== 'missed' && tab !== 'summary' });
  const { data: lessons, reload: reloadL } = useApi('/lessons' + qs({ subject_id: subj }), { skip: tab !== 'library' });
  const review = async (l) => { try { await api.post(`/lessons/${l.id}/review`, { reviewed: !l.reviewed }); reload(); reloadL(); } catch (e) { toast.error(e.message); } };
  const save = async () => { const b = { subject_id: Number(form.subject_id), lesson_date: form.lesson_date, topic: form.topic, notes: form.notes || null, video_url: form.video_url || null, resource_url: form.resource_url || null };
    try { if (form.id) await api.put(`/lessons/${form.id}`, b); else await api.post('/lessons', b); toast(form.id ? 'Lesson updated' : 'Lesson added'); setForm(null); reloadL(); reload(); } catch (e) { toast.error(e.message); } };
  const del = async (l) => { if (await confirm({ title: 'Delete lesson', message: `Delete "${l.topic}"?`, confirmText: 'Delete' })) { try { await api.del(`/lessons/${l.id}`); toast('Lesson deleted'); reloadL(); } catch (e) { toast.error(e.message); } } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const writable = (subjects || []).filter((s) => user.role === 'admin' || s.teacher_id === user.teacherId);
  const list = Array.isArray(missed) && (student || sid) ? missed.filter((l) => !status || (status === 'pending' ? !l.reviewed : l.reviewed)).filter((l) => !subj || String(l.subject_id) === subj) : [];
  const done = Array.isArray(missed) && (student || sid) ? missed.filter((l) => l.reviewed).length : 0; const total = Array.isArray(missed) && (student || sid) ? missed.length : 0;
  const tabs = [...(student ? [{ id: 'missed', label: 'Missed topics', icon: <BookOpenCheck className="h-4 w-4" /> }] : [{ id: 'summary', label: 'Student overview', icon: <BookOpenCheck className="h-4 w-4" /> }]), { id: 'library', label: 'Lessons & resources', icon: <Library className="h-4 w-4" /> }];
  return (<>
    <PageHeader title="Missed Courses" subtitle="Missed topics, notes, recorded lessons and learning resources." actions={<>{isStaff && <StudentSelect students={students} value={sid} onChange={(v) => { setSid(v); if (v) setTab('summary'); }} />}{isStaff && <button className="btn-primary" onClick={() => setForm({ subject_id: '', lesson_date: today(), topic: '', notes: '', video_url: '', resource_url: '' })}><Plus className="h-4 w-4" />Add lesson</button>}</>} />
    <Tabs tabs={tabs} value={tab} onChange={setTab} />
    {(tab === 'missed' || (tab === 'summary' && sid)) && (loading && !missed ? <Loading /> : (<>
      <div className="grid gap-4 sm:grid-cols-3"><Stat label="Missed topics" value={total} icon={BookOpenCheck} tone="rose" /><Stat label="Reviewed" value={done} icon={CheckCircle2} tone="emerald" /><Stat label="Still to catch up" value={total - done} icon={Circle} tone="amber" /></div>
      <Card className="mt-6"><div className="flex items-center justify-between text-sm"><span className="font-semibold text-navy-900">Catch-up progress</span><span className="text-slate-500">{done}/{total}</span></div><Progress value={total ? (100 * done) / total : 100} className="mt-2" tone="bg-iris-500" /></Card>
      <div className="my-5 flex flex-wrap gap-3"><FilterSelect label="Status" value={status} onChange={setStatus}><option value="">All</option><option value="pending">To review</option><option value="done">Reviewed</option></FilterSelect>
        <FilterSelect label="Subject" value={subj} onChange={setSubj}><option value="">All</option>{[...new Map((missed || []).map((l) => [l.subject_id, l])).values()].map((l) => <option key={l.subject_id} value={l.subject_id}>{l.code}</option>)}</FilterSelect></div>
      {!list.length ? <Card><Empty title={total ? 'Nothing matches the filters' : 'No missed topics'} hint={total ? '' : 'You are all caught up. Keep attending!'} /></Card> : <div className="grid gap-4 lg:grid-cols-2">{list.map((l) => <LessonCard key={l.id} l={{ ...l, missed: true }} student={student} onReview={review} />)}</div>}</>))}
    {tab === 'summary' && !sid && (loading && !missed ? <Loading /> : <Card title="Students with missed topics" subtitle="Select a student above to see their lessons." pad={false}>{!missed?.length ? <Empty title="No missed topics" /> : (
      <TableWrap><thead><tr><th className="th">Student</th><th className="th">Missed</th><th className="th">To review</th><th className="th" /></tr></thead><tbody>{missed.map((s) => (<tr key={s.student_id}><td className="td"><b className="font-semibold">{s.name}</b><span className="ml-1 text-xs text-slate-400">{s.roll_no}</span></td><td className="td">{s.missed}</td><td className="td"><Badge tone={s.pending ? 'amber' : 'emerald'}>{s.pending}</Badge></td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => setSid(String(s.student_id))}>View</button></td></tr>))}</tbody></TableWrap>)}</Card>)}
    {tab === 'library' && (<><div className="mb-5"><FilterSelect label="Subject" value={subj} onChange={setSubj}><option value="">All subjects</option>{(subjects || []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</FilterSelect></div>
      {!lessons ? <Loading /> : !lessons.length ? <Card><Empty title="No lessons yet" /></Card> : <div className="grid gap-4 lg:grid-cols-2">{lessons.map((l) => (<div key={l.id} className="relative"><LessonCard l={l} student={student} onReview={review} />
        {isStaff && <div className="absolute right-3 top-3 flex rounded-lg bg-white/90"><button className="btn-ghost btn-sm" aria-label="Edit" onClick={() => setForm({ ...l })}><Pencil className="h-3.5 w-3.5" /></button><button className="btn-ghost btn-sm !text-rose-500" aria-label="Delete" onClick={() => del(l)}><Trash2 className="h-3.5 w-3.5" /></button></div>}</div>))}</div>}</>)}
    <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit lesson' : 'Add lesson'} footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={!form?.subject_id || (form?.topic || '').length < 2} onClick={save}>Save</button></>}>
      {form && <div className="grid gap-4 sm:grid-cols-2"><Select label="Subject" className="sm:col-span-2" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}><option value="">Select…</option>{writable.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</Select>
        <Input label="Topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /><Input label="Class date" type="date" max={today()} value={form.lesson_date} onChange={(e) => setForm({ ...form, lesson_date: e.target.value })} />
        <Textarea label="Notes" className="sm:col-span-2" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><Input label="Recorded lesson URL" className="sm:col-span-2" type="url" placeholder="https://…" value={form.video_url || ''} onChange={(e) => setForm({ ...form, video_url: e.target.value })} /><Input label="Resource URL" className="sm:col-span-2" type="url" placeholder="https://…" value={form.resource_url || ''} onChange={(e) => setForm({ ...form, resource_url: e.target.value })} /></div>}</Modal>
  </>);
}
