import { useState } from 'react';
import { GraduationCap, Award, AlertTriangle, BookMarked, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Badge, StudentSelect, TableWrap, Modal, Select } from '../lib/ui.jsx';
import { BarC, LineC, PieC } from '../lib/charts.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';

const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'];
const gTone = (g) => ({ O: 'emerald', 'A+': 'emerald', A: 'sky', 'B+': 'sky', B: 'amber', C: 'amber', F: 'rose' }[g]);

function Detail({ sid, canEdit, onChange }) {
  const toast = useToast(); const confirm = useConfirm();
  const { data, loading, error, reload } = useApi('/results' + qs({ student_id: sid }));
  const [open, setOpen] = useState({}); const [add, setAdd] = useState(null);
  const { data: subs } = useApi(add ? '/subjects' : null, { skip: !add });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  const refresh = () => { reload(); onChange?.(); };
  const del = async (r) => { if (await confirm({ title: 'Remove grade', message: `Remove the grade for ${r.name}?`, confirmText: 'Remove' })) { try { await api.del(`/results/${r.id}`); toast('Grade removed'); refresh(); } catch (e) { toast.error(e.message); } } };
  const save = async () => { try { await api.post('/results', { student_id: Number(sid), subject_id: Number(add.subject_id), semester: Number(add.semester), grade: add.grade }); toast('Result saved'); setAdd(null); refresh(); } catch (e) { toast.error(e.message); } };
  const total = data.semesters.reduce((a, s) => a + s.credits, 0);
  return (<>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="CGPA" value={data.cgpa ?? '—'} sub="Cumulative, 10-point scale" icon={GraduationCap} tone="iris" /><Stat label="Latest GPA" value={data.semesters.at(-1)?.gpa ?? '—'} sub={data.semesters.length ? `Semester ${data.semesters.at(-1).semester}` : ''} icon={Award} tone="emerald" /><Stat label="Credits earned" value={total} icon={BookMarked} tone="navy" /><Stat label="Backlogs" value={data.semesters.reduce((a, s) => a + s.backlogs, 0)} sub="Subjects with grade F" icon={AlertTriangle} tone="rose" /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><Card title="GPA by semester"><LineC data={data.semesters.map((s) => ({ name: `Sem ${s.semester}`, gpa: s.gpa }))} xKey="name" lines={[{ key: 'gpa', name: 'GPA', color: '#7554dc' }]} domain={[0, 10]} unit="" /></Card>
      <Card title="Grades distribution"><BarC data={GRADES.map((g) => ({ name: g, count: data.semesters.flatMap((s) => s.subjects).filter((x) => x.grade === g).length }))} xKey="name" bars={[{ key: 'count', name: 'Subjects', color: '#1d3a78' }]} unit="" /></Card></div>
    <div className="mt-6 flex items-center justify-between"><h3 className="text-base font-semibold">Semester results</h3>{canEdit && <button className="btn-primary btn-sm" onClick={() => setAdd({ subject_id: '', semester: 1, grade: 'A' })}><Plus className="h-3.5 w-3.5" />Add grade</button>}</div>
    {!data.semesters.length ? <Card className="mt-3"><Empty title="No published results" /></Card> : <div className="mt-3 space-y-3">{data.semesters.map((s) => (
      <div key={s.semester} className="card overflow-hidden"><button className="flex w-full items-center justify-between gap-3 p-5 text-left" onClick={() => setOpen({ ...open, [s.semester]: !open[s.semester] })}>
        <div><p className="font-semibold text-navy-900">Semester {s.semester}</p><p className="text-xs text-slate-500">{s.subjects.length} subjects · {s.credits} credits</p></div>
        <div className="flex items-center gap-3"><Badge tone={s.backlogs ? 'rose' : 'emerald'}>{s.backlogs ? `${s.backlogs} backlog` : 'All cleared'}</Badge><span className="text-xl font-bold text-iris-600">{s.gpa}</span><ChevronDown className={`h-5 w-5 text-slate-400 transition ${open[s.semester] ? 'rotate-180' : ''}`} /></div></button>
        {open[s.semester] && <TableWrap><thead><tr><th className="th">Code</th><th className="th">Subject</th><th className="th">Credits</th><th className="th">Grade</th><th className="th">Points</th>{canEdit && <th className="th" />}</tr></thead>
          <tbody>{s.subjects.map((r) => (<tr key={r.id}><td className="td font-mono text-xs">{r.code}</td><td className="td">{r.name}</td><td className="td">{r.credits}</td><td className="td"><Badge tone={gTone(r.grade)}>{r.grade}</Badge></td><td className="td">{r.points}</td>{canEdit && <td className="td text-right"><button className="btn-ghost btn-sm !text-rose-500" aria-label="Delete" onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></button></td>}</tr>))}</tbody></TableWrap>}</div>))}</div>}
    <Modal open={!!add} onClose={() => setAdd(null)} title="Add / update grade" size="sm" footer={<><button className="btn-secondary" onClick={() => setAdd(null)}>Cancel</button><button className="btn-primary" disabled={!add?.subject_id} onClick={save}>Save</button></>}>
      {add && <div className="space-y-4"><Select label="Subject" value={add.subject_id} onChange={(e) => { const s = subs?.find((x) => x.id === Number(e.target.value)); setAdd({ ...add, subject_id: e.target.value, semester: s?.semester || add.semester }); }}><option value="">Select…</option>{subs?.map((s) => <option key={s.id} value={s.id}>Sem {s.semester} · {s.code} · {s.name}</option>)}</Select>
        <Select label="Grade" value={add.grade} onChange={(e) => setAdd({ ...add, grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</Select></div>}</Modal>
  </>);
}

export default function Results() {
  const { user, isStaff } = useAuth();
  const [sid, setSid] = useState('');
  const { data: students } = useStudents(isStaff);
  const { data, loading, error, reload } = useApi('/results', { skip: !isStaff });
  const picker = isStaff && <StudentSelect students={students} value={sid} onChange={setSid} all="Class overview" />;
  if (!isStaff) return (<><PageHeader title="Results" subtitle="Grades, GPA, CGPA and semester results." /><Detail sid={user.studentId} /></>);
  if (sid) return (<><PageHeader title="Results" subtitle="Grades, GPA, CGPA and semester results." actions={picker} /><Detail key={sid} sid={sid} canEdit onChange={reload} /></>);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  const withC = data.students.filter((s) => s.cgpa !== null);
  return (<>
    <PageHeader title="Results" subtitle="Class results overview — select a student to view or edit grades." actions={picker} />
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Average CGPA" value={withC.length ? (withC.reduce((a, b) => a + b.cgpa, 0) / withC.length).toFixed(2) : '—'} icon={GraduationCap} tone="iris" /><Stat label="Students with backlogs" value={data.students.filter((s) => s.backlogs).length} icon={AlertTriangle} tone="rose" /><Stat label="Distinction (CGPA ≥ 8.5)" value={withC.filter((s) => s.cgpa >= 8.5).length} icon={Award} tone="emerald" /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-3"><Card title="Grade distribution"><PieC data={data.distribution.map((d) => ({ name: d.grade, value: d.count }))} unit="" /></Card>
      <Card title="CGPA by student" className="lg:col-span-2"><BarC data={withC.map((s) => ({ name: s.roll_no.slice(-5), cgpa: s.cgpa }))} xKey="name" bars={[{ key: 'cgpa', name: 'CGPA', color: '#7554dc' }]} domain={[0, 10]} unit="" /></Card></div>
    <Card className="mt-6" pad={false}><TableWrap><thead><tr><th className="th">Student</th><th className="th">Dept</th><th className="th">CGPA</th><th className="th">Latest GPA</th><th className="th">Backlogs</th><th className="th" /></tr></thead>
      <tbody>{data.students.map((s) => (<tr key={s.id}><td className="td"><b className="font-semibold">{s.name}</b><span className="ml-1 text-xs text-slate-400">{s.roll_no}</span></td><td className="td">{s.department}</td><td className="td font-semibold text-iris-700">{s.cgpa ?? '—'}</td><td className="td">{s.latest_gpa ?? '—'}</td><td className="td"><Badge tone={s.backlogs ? 'rose' : 'emerald'}>{s.backlogs}</Badge></td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => setSid(String(s.id))}>View</button></td></tr>))}</tbody></TableWrap></Card></>);
}
