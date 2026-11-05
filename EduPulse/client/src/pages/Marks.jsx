import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ClipboardList, ClipboardCheck, Users2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Tabs, Badge, FilterSelect, StudentSelect, TableWrap, Modal, Input, Select, Textarea, Progress } from '../lib/ui.jsx';
import { BarC } from '../lib/charts.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { fdate, pct, today, cap, toneForPct } from '../lib/format.js';
import Gradebook from '../components/Gradebook.jsx';

const TYPES = [['internal', 'Internal'], ['assignment', 'Assignment'], ['semester', 'Semester / Model']];
const blank = (sub) => ({ student_id: '', subject_id: sub || '', type: 'internal', title: '', score: '', max_score: 50, exam_date: today() });

function MarkForm({ open, onClose, initial, students, subjects, onSaved }) {
  const toast = useToast(); const [f, setF] = useState(initial); const edit = !!initial?.id;
  if (!f) return null;
  const save = async () => {
    const body = { type: f.type, title: f.title, score: Number(f.score), max_score: Number(f.max_score), exam_date: f.exam_date };
    try { if (edit) await api.put(`/marks/${f.id}`, body); else await api.post('/marks', { ...body, student_id: Number(f.student_id), subject_id: Number(f.subject_id) }); toast(edit ? 'Marks updated' : 'Marks added'); onSaved(); onClose(); } catch (e) { toast.error(e.message); }
  };
  return (<Modal open={open} onClose={onClose} title={edit ? 'Edit marks' : 'Add marks'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={!f.title || f.score === '' || (!edit && (!f.student_id || !f.subject_id))}>Save</button></>}>
    <div className="grid gap-4 sm:grid-cols-2">
      {!edit && <><Select label="Student" value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })} className="sm:col-span-2"><option value="">Select student…</option>{students?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>)}</Select>
        <Select label="Subject" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })} className="sm:col-span-2"><option value="">Select subject…</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</Select></>}
      <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="CAT 1" />
      <Input label="Score" type="number" min="0" step="0.5" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /><Input label="Out of" type="number" min="1" value={f.max_score} onChange={(e) => setF({ ...f, max_score: e.target.value })} />
      <Input label="Date" type="date" value={f.exam_date} onChange={(e) => setF({ ...f, exam_date: e.target.value })} className="sm:col-span-2" /></div></Modal>);
}

function BulkForm({ open, onClose, subjects, onSaved }) {
  const toast = useToast();
  const [h, setH] = useState({ subject_id: '', type: 'internal', title: '', max_score: 50, exam_date: today() }); const [scores, setScores] = useState({});
  const { data: roster } = useApi(h.subject_id ? `/attendance/roster?subject_id=${h.subject_id}&date=${today()}` : null, { skip: !h.subject_id });
  const entries = Object.entries(scores).filter(([, v]) => v !== '').map(([id, v]) => ({ student_id: Number(id), score: Number(v) }));
  const save = async () => { try { const r = await api.post('/marks/bulk', { ...h, subject_id: Number(h.subject_id), max_score: Number(h.max_score), entries }); toast(`Marks saved for ${r.saved} students`); setScores({}); onSaved(); onClose(); } catch (e) { toast.error(e.message); } };
  return (<Modal open={open} onClose={onClose} size="lg" title="Bulk marks entry" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!h.title || !entries.length} onClick={save}>Save {entries.length} entries</button></>}>
    <div className="grid gap-4 sm:grid-cols-3"><Select label="Subject" value={h.subject_id} onChange={(e) => setH({ ...h, subject_id: e.target.value })} className="sm:col-span-3"><option value="">Select subject…</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</Select>
      <Select label="Type" value={h.type} onChange={(e) => setH({ ...h, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select><Input label="Title" value={h.title} onChange={(e) => setH({ ...h, title: e.target.value })} placeholder="CAT 2" /><Input label="Out of" type="number" value={h.max_score} onChange={(e) => setH({ ...h, max_score: e.target.value })} />
      <Input label="Date" type="date" value={h.exam_date} onChange={(e) => setH({ ...h, exam_date: e.target.value })} /></div>
    {roster && <div className="mt-5 max-h-72 overflow-y-auto rounded-xl border border-slate-100"><TableWrap><thead><tr><th className="th">Roll no</th><th className="th">Student</th><th className="th w-32">Score</th></tr></thead><tbody>{roster.map((r) => (<tr key={r.student_id}><td className="td font-mono text-xs">{r.roll_no}</td><td className="td">{r.name}</td><td className="td"><input type="number" min="0" max={h.max_score} className="input !py-1.5" value={scores[r.student_id] ?? ''} onChange={(e) => setScores({ ...scores, [r.student_id]: e.target.value })} /></td></tr>))}</tbody></TableWrap></div>}</Modal>);
}

function Tasks({ subjects }) {
  const { user, isStaff } = useAuth(); const toast = useToast(); const confirm = useConfirm();
  const { data, loading, reload } = useApi('/tasks'); const [open, setOpen] = useState(false); const [f, setF] = useState({ subject_id: '', title: '', description: '', due_date: today() });
  const create = async () => { try { await api.post('/tasks', { ...f, subject_id: Number(f.subject_id) }); toast('Assignment posted'); setOpen(false); reload(); } catch (e) { toast.error(e.message); } };
  const submit = async (t) => { try { const r = await api.post(`/tasks/${t.id}/submit`); toast(r.status === 'late' ? 'Submitted (late)' : 'Assignment submitted'); reload(); } catch (e) { toast.error(e.message); } };
  const del = async (t) => { if (await confirm({ title: 'Delete assignment', message: `Delete "${t.title}"?`, confirmText: 'Delete' })) { try { await api.del(`/tasks/${t.id}`); toast('Deleted'); reload(); } catch (e) { toast.error(e.message); } } };
  const STATE = { done: ['emerald', 'Submitted', CheckCircle2], overdue: ['rose', 'Overdue', AlertCircle], pending: ['amber', 'Pending', Clock] };
  return (<>
    {isStaff && <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Post assignment</button></div>}
    <Card pad={false}>{loading && !data ? <Loading /> : !data?.length ? <Empty title="No assignments" /> : (
      <TableWrap><thead><tr><th className="th">Assignment</th><th className="th">Subject</th><th className="th">Due</th><th className="th">{isStaff ? 'Submissions' : 'Status'}</th><th className="th text-right">Actions</th></tr></thead>
        <tbody>{data.map((t) => { const S = STATE[t.state]; const Ic = S[2]; return (<tr key={t.id}><td className="td font-medium">{t.title}</td><td className="td">{t.code}</td><td className="td">{fdate(t.due_date)}</td>
          <td className="td">{isStaff ? <div className="flex items-center gap-3"><Progress value={t.total ? (100 * t.submitted) / t.total : 0} tone="bg-iris-500" className="w-28" /><span className="text-xs text-slate-500">{t.submitted}/{t.total}</span></div> : <Badge tone={S[0]}><Ic className="h-3 w-3" />{S[1]}{t.status === 'late' ? ' (late)' : ''}</Badge>}</td>
          <td className="td text-right">{user.role === 'student' && t.state !== 'done' && <button className="btn-accent btn-sm" onClick={() => submit(t)}>Mark submitted</button>}{isStaff && <button className="btn-ghost btn-sm !text-rose-500" onClick={() => del(t)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}</td></tr>); })}</tbody></TableWrap>)}</Card>
    <Modal open={open} onClose={() => setOpen(false)} title="Post assignment" footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={!f.subject_id || f.title.length < 2} onClick={create}>Post</button></>}>
      <div className="space-y-4"><Select label="Subject" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}><option value="">Select…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</Select><Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /><Input label="Due date" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div></Modal></>);
}

export default function Marks() {
  const { user, isStaff } = useAuth(); const toast = useToast(); const confirm = useConfirm();
  const [tab, setTab] = useState('marks'); const [f, setF] = useState({ student_id: '', subject_id: '', type: '' });
  const [form, setForm] = useState(null); const [bulk, setBulk] = useState(false);
  const { data: students } = useStudents(isStaff);
  const { data: subjects } = useApi(user.role === 'teacher' ? '/subjects?mine=1' : '/subjects');
  const { data: marks, loading, error, reload } = useApi('/marks' + qs(f));
  const bySubject = useMemo(() => { const m = {}; (marks || []).forEach((x) => { m[x.code] ||= { name: x.code }; (m[x.code][x.type] ||= []).push(x.pct); }); return Object.values(m).map((s) => ({ name: s.name, ...Object.fromEntries(TYPES.map(([t]) => [t, s[t] ? Math.round(s[t].reduce((a, b) => a + b, 0) / s[t].length * 10) / 10 : null])) })); }, [marks]);
  const stats = useMemo(() => { const g = (t) => { const l = (marks || []).filter((x) => x.type === t); return l.length ? l.reduce((a, b) => a + b.pct, 0) / l.length : null; }; return { internal: g('internal'), assignment: g('assignment'), semester: g('semester') }; }, [marks]);
  const del = async (m) => { if (await confirm({ title: 'Delete marks', message: `Delete ${m.title} for ${m.student}?`, confirmText: 'Delete' })) { try { await api.del(`/marks/${m.id}`); toast('Marks deleted'); reload(); } catch (e) { toast.error(e.message); } } };
  const writable = (subjects || []).filter((s) => user.role === 'admin' || s.teacher_id === user.teacherId);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (<>
    <PageHeader title="Marks" subtitle="Internal, assignment and semester marks." actions={isStaff && <><button className="btn-secondary" onClick={() => setBulk(true)}><Users2 className="h-4 w-4" />Bulk entry</button><button className="btn-primary" onClick={() => setForm(blank())}><Plus className="h-4 w-4" />Add marks</button></>} />
    <Tabs tabs={[{ id: 'marks', label: 'Marks', icon: <ClipboardList className="h-4 w-4" /> }, ...(isStaff ? [{ id: 'gradebook', label: 'Live gradebook', icon: <ClipboardCheck className="h-4 w-4" /> }] : []), { id: 'tasks', label: 'Assignments tracker', icon: <ClipboardCheck className="h-4 w-4" /> }]} value={tab} onChange={setTab} />
    {tab === 'gradebook' ? <Gradebook key={writable[0]?.id} subjects={[...writable].sort((a, b) => b.semester - a.semester)} /> : tab === 'tasks' ? <Tasks subjects={writable} /> : (<>
      <div className="grid gap-4 sm:grid-cols-3"><Stat label="Internal avg" value={pct(stats.internal)} icon={ClipboardList} tone="navy" /><Stat label="Assignment avg" value={pct(stats.assignment)} icon={ClipboardCheck} tone="iris" /><Stat label="Semester / model avg" value={pct(stats.semester)} icon={ClipboardList} tone="sky" /></div>
      <Card title="Subject-wise averages" subtitle="By assessment type" className="mt-6"><BarC data={bySubject} xKey="name" bars={[{ key: 'internal', name: 'Internal', color: '#1d3a78' }, { key: 'assignment', name: 'Assignment', color: '#a28ff5' }, { key: 'semester', name: 'Semester', color: '#38bdf8' }]} domain={[0, 100]} /></Card>
      <div className="my-5 flex flex-wrap items-center gap-3">{isStaff && <StudentSelect students={students} value={f.student_id} onChange={(v) => setF({ ...f, student_id: v })} />}
        <FilterSelect label="Subject" value={f.subject_id} onChange={(v) => setF({ ...f, subject_id: v })}><option value="">All</option>{(subjects || []).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</FilterSelect>
        <FilterSelect label="Type" value={f.type} onChange={(v) => setF({ ...f, type: v })}><option value="">All</option>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</FilterSelect></div>
      <Card pad={false}>{loading && !marks ? <Loading /> : !marks?.length ? <Empty title="No marks recorded" hint="Marks will appear here once entered by your teachers." /> : (
        <TableWrap><thead><tr>{isStaff && <th className="th">Student</th>}<th className="th">Subject</th><th className="th">Assessment</th><th className="th">Type</th><th className="th">Score</th><th className="th">%</th><th className="th">Date</th>{isStaff && <th className="th text-right">Actions</th>}</tr></thead>
          <tbody>{marks.map((m) => (<tr key={m.id}>{isStaff && <td className="td"><b className="font-semibold">{m.student}</b><span className="ml-1 text-xs text-slate-400">{m.roll_no}</span></td>}<td className="td">{m.code} · {m.subject}</td><td className="td font-medium">{m.title}</td><td className="td"><Badge tone="navy">{cap(m.type)}</Badge></td><td className="td">{m.score}/{m.max_score}</td><td className="td"><Badge tone={toneForPct(m.pct)}>{pct(m.pct)}</Badge></td><td className="td">{fdate(m.exam_date)}</td>
            {isStaff && <td className="td text-right"><button className="btn-ghost btn-sm" aria-label="Edit" onClick={() => setForm({ ...m })}><Pencil className="h-3.5 w-3.5" /></button><button className="btn-ghost btn-sm !text-rose-500" aria-label="Delete" onClick={() => del(m)}><Trash2 className="h-3.5 w-3.5" /></button></td>}</tr>))}</tbody></TableWrap>)}</Card></>)}
    {form && <MarkForm open onClose={() => setForm(null)} initial={form} students={students} subjects={writable} onSaved={reload} />}
    {bulk && <BulkForm open onClose={() => setBulk(false)} subjects={writable} onSaved={reload} />}
  </>);
}
