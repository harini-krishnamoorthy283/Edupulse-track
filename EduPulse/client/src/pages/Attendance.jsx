import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, ListChecks, Pencil, Trash2, Save, CheckCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Tabs, Badge, FilterSelect, StudentSelect, TableWrap, Progress, Modal, Select } from '../lib/ui.jsx';
import { AreaC, BarC } from '../lib/charts.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { fdate, pct, today, monthLabel, toneForPct } from '../lib/format.js';

const ST = { present: ['emerald', 'Present'], absent: ['rose', 'Absent'], late: ['amber', 'Late'] };

function Mark({ subjects }) {
  const toast = useToast();
  const [sub, setSub] = useState(subjects[0]?.id || ''); const [date, setDate] = useState(today());
  const { data, loading, reload, setData } = useApi(sub ? `/attendance/roster?subject_id=${sub}&date=${date}` : null, { skip: !sub });
  const [saving, setSaving] = useState(false);
  const setAll = (s) => setData(data.map((r) => ({ ...r, status: s })));
  const save = async () => { setSaving(true); try { const r = await api.post('/attendance/bulk', { subject_id: Number(sub), date, records: data.map((x) => ({ student_id: x.student_id, status: x.status || 'present' })) }); toast(`Attendance saved for ${r.saved} students`); reload(); } catch (e) { toast.error(e.message); } finally { setSaving(false); } };
  return (
    <Card title="Mark attendance" subtitle="Select a subject and date, then record each student's status." action={<div className="flex gap-2"><button className="btn-secondary btn-sm" onClick={() => setAll('present')}><CheckCheck className="h-3.5 w-3.5" />All present</button><button className="btn-primary btn-sm" onClick={save} disabled={saving || !data?.length}><Save className="h-3.5 w-3.5" />Save</button></div>}>
      <div className="mb-4 flex flex-wrap gap-3"><FilterSelect label="Subject" value={sub} onChange={setSub}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</FilterSelect>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Date<input type="date" className="input !w-auto !py-2 text-xs" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></label></div>
      {loading && !data ? <Loading /> : !data?.length ? <Empty title="No students to mark" hint="No assigned students match this subject's department and semester." /> : (
        <TableWrap><thead><tr><th className="th">Roll no</th><th className="th">Student</th><th className="th">Status</th></tr></thead>
          <tbody>{data.map((r, i) => (<tr key={r.student_id}><td className="td font-mono text-xs">{r.roll_no}</td><td className="td font-medium">{r.name}</td>
            <td className="td"><div className="inline-flex rounded-xl bg-slate-100 p-0.5">{['present', 'late', 'absent'].map((s) => (
              <button key={s} onClick={() => setData(data.map((x, k) => (k === i ? { ...x, status: s } : x)))} className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition ${(r.status || 'present') === s ? { present: 'bg-emerald-500 text-white', late: 'bg-amber-500 text-white', absent: 'bg-rose-500 text-white' }[s] : 'text-slate-500'}`}>{s}</button>))}</div>
              {!r.status && <span className="ml-2 text-[10px] text-slate-400">not yet marked</span>}</td></tr>))}</tbody></TableWrap>)}
    </Card>
  );
}

export default function Attendance() {
  const { user, isStaff } = useAuth(); const toast = useToast(); const confirm = useConfirm();
  const [tab, setTab] = useState('overview');
  const [f, setF] = useState({ student_id: '', subject_id: '', from: '', to: '' });
  const [edit, setEdit] = useState(null);
  const { data: students } = useStudents(isStaff);
  const { data: subjects } = useApi(user.role === 'teacher' ? '/subjects?mine=1' : '/subjects');
  const { data: sum, loading, error, reload } = useApi('/attendance/summary' + qs(f));
  const { data: recs, reload: reloadRecs } = useApi(tab === 'records' ? '/attendance' + qs(f) : null, { skip: tab !== 'records' });
  const markable = useMemo(() => (subjects || []).filter((s) => user.role === 'admin' || s.teacher_id === user.teacherId).sort((a, b) => b.semester - a.semester || a.code.localeCompare(b.code)), [subjects, user]);
  const tabs = [{ id: 'overview', label: 'Overview', icon: <CalendarCheck className="h-4 w-4" /> }, { id: 'records', label: 'Daily records', icon: <CalendarDays className="h-4 w-4" /> }, ...(isStaff ? [{ id: 'mark', label: 'Mark attendance', icon: <ListChecks className="h-4 w-4" /> }] : [])];
  const refresh = () => { reload(); reloadRecs(); };
  const remove = async (r) => { if (!(await confirm({ title: 'Delete record', message: `Remove ${r.student}'s attendance for ${r.subject} on ${fdate(r.date)}?`, confirmText: 'Delete' }))) return; try { await api.del(`/attendance/${r.id}`); toast('Record deleted'); refresh(); } catch (e) { toast.error(e.message); } };
  const saveEdit = async () => { try { await api.put(`/attendance/${edit.id}`, { status: edit.status }); toast('Attendance updated'); setEdit(null); refresh(); } catch (e) { toast.error(e.message); } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const o = sum?.overall;
  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily, monthly and subject-wise attendance records." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab !== 'mark' && (<div className="mb-5 flex flex-wrap items-center gap-3">
        {isStaff && <StudentSelect students={students} value={f.student_id} onChange={(v) => setF({ ...f, student_id: v })} />}
        <FilterSelect label="Subject" value={f.subject_id} onChange={(v) => setF({ ...f, subject_id: v })}><option value="">All subjects</option>{(subjects || []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</FilterSelect>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">From<input type="date" className="input !w-auto !py-2 text-xs" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">To<input type="date" className="input !w-auto !py-2 text-xs" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        {(f.student_id || f.subject_id || f.from || f.to) && <button className="btn-ghost btn-sm" onClick={() => setF({ student_id: '', subject_id: '', from: '', to: '' })}>Clear filters</button>}</div>)}

      {tab === 'mark' && (markable.length ? <Mark key={markable[0].id} subjects={markable} /> : <Card><Empty title="No subjects assigned" hint="Ask an administrator to assign subjects to you." /></Card>)}
      {tab === 'overview' && (loading && !sum ? <Loading /> : (<>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Overall attendance" value={pct(o.pct)} sub={o.pct !== null && o.pct < 75 ? 'Below 75% requirement' : 'Meets requirement'} subTone={o.pct !== null && o.pct < 75 ? 'text-rose-600' : 'text-emerald-600'} icon={CalendarCheck} tone="sky" />
          <Stat label="Classes attended" value={o.present} sub={`of ${o.total} sessions`} icon={ListChecks} tone="emerald" />
          <Stat label="Classes missed" value={o.total - o.present} sub="Absent sessions" icon={AlertTriangle} tone="rose" />
          <Stat label="Subjects below 75%" value={sum.subjects.filter((s) => s.pct < 75).length} sub={`of ${sum.subjects.length} subjects`} icon={CalendarDays} tone="amber" /></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Monthly attendance" subtitle="Dashed line marks the 75% minimum"><AreaC data={sum.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }))} xKey="label" dataKey="pct" name="Attendance" minLine={75} /></Card>
          <Card title="Subject-wise attendance"><BarC data={sum.subjects.map((s) => ({ name: s.code, pct: s.pct }))} xKey="name" bars={[{ key: 'pct', name: 'Attendance', color: '#1d3a78' }]} domain={[0, 100]} /></Card>
          <Card title="Last 30 sessions (daily)" className="lg:col-span-2"><BarC data={sum.daily.map((d) => ({ name: fdate(d.date).slice(0, 6), pct: d.pct }))} xKey="name" bars={[{ key: 'pct', name: 'Present %', color: '#a28ff5' }]} domain={[0, 100]} h={220} /></Card></div>
        <Card title="Subject breakdown" className="mt-6" pad={false}><TableWrap><thead><tr><th className="th">Subject</th><th className="th">Attended</th><th className="th">Total</th><th className="th w-1/3">Attendance</th></tr></thead>
          <tbody>{sum.subjects.map((s) => (<tr key={s.id}><td className="td"><b className="font-semibold text-navy-800">{s.code}</b> <span className="text-slate-500">{s.name}</span></td><td className="td">{s.present}</td><td className="td">{s.total}</td><td className="td"><div className="flex items-center gap-3"><Progress value={s.pct} className="flex-1" /><Badge tone={toneForPct(s.pct)}>{pct(s.pct)}</Badge></div></td></tr>))}</tbody></TableWrap></Card>
        {isStaff && !f.student_id && sum.students.length > 0 && <Card title="Students by attendance" subtitle="Lowest first" className="mt-6" pad={false}><TableWrap><thead><tr><th className="th">Roll no</th><th className="th">Student</th><th className="th">Attendance</th></tr></thead>
          <tbody>{sum.students.map((s) => (<tr key={s.id}><td className="td font-mono text-xs">{s.roll_no}</td><td className="td font-medium">{s.name}</td><td className="td"><div className="flex items-center gap-3"><Progress value={s.pct} className="w-40" /><Badge tone={toneForPct(s.pct)}>{pct(s.pct)}</Badge></div></td></tr>))}</tbody></TableWrap></Card>}
      </>))}
      {tab === 'records' && (<Card pad={false}>{!recs ? <Loading /> : !recs.length ? <Empty title="No records" hint="Adjust the filters." /> : (
        <TableWrap><thead><tr><th className="th">Date</th>{isStaff && <th className="th">Student</th>}<th className="th">Subject</th><th className="th">Status</th>{isStaff && <th className="th text-right">Actions</th>}</tr></thead>
          <tbody>{recs.map((r) => (<tr key={r.id}><td className="td">{fdate(r.date)}</td>{isStaff && <td className="td"><b className="font-semibold">{r.student}</b> <span className="text-xs text-slate-400">{r.roll_no}</span></td>}<td className="td">{r.code} · {r.subject}</td>
            <td className="td"><Badge tone={ST[r.status][0]}>{ST[r.status][1]}</Badge></td>
            {isStaff && <td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => setEdit({ ...r })} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button><button className="btn-ghost btn-sm !text-rose-500" onClick={() => remove(r)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></td>}</tr>))}</tbody></TableWrap>)}
        {recs?.length === 500 && <p className="p-3 text-center text-xs text-slate-400">Showing latest 500 records — narrow with filters.</p>}</Card>)}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit attendance" size="sm" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveEdit}>Save</button></>}>
        {edit && <><p className="mb-4 text-sm text-slate-600">{edit.student} · {edit.subject} · {fdate(edit.date)}</p><Select label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></Select></>}
      </Modal>
    </>
  );
}
