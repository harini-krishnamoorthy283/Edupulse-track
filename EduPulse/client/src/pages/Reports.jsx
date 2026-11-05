import { useMemo, useState } from 'react';
import { FileText, Printer, Download, Table2, Users, AlertTriangle, GraduationCap, Award, CalendarCheck, Wallet } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Tabs, Badge, StudentSelect, TableWrap, FilterSelect, Progress, SeverityBadge } from '../lib/ui.jsx';
import { BarC } from '../lib/charts.jsx';
import Gradebook from '../components/Gradebook.jsx';
import { downloadCsv } from '../lib/csv.js';
import { pct, inr, fdate, toneForPct, cap } from '../lib/format.js';

const band = (p) => (p === null || p === undefined ? '—' : p >= 90 ? 'O' : p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'B+' : p >= 50 ? 'B' : p >= 40 ? 'C' : 'F');
const RULE = { attendance: 'Low attendance', marks: 'Low marks', absence: 'Continuous absence', performance: 'Performance decline', assignments: 'Incomplete assignments', fees: 'Overdue fees' };

function ReportCard({ sid }) {
  const { data: d, loading, error, reload } = useApi(sid ? `/reports/student-card?student_id=${sid}` : null, { skip: !sid });
  if (!sid) return <Card><Empty title="Select a student" hint="Choose a student above to generate their report card." /></Card>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !d) return <Loading />;
  const s = d.student;
  const csv = () => downloadCsv(`${s.roll_no}-report-card.csv`, [['Report card', s.name, s.roll_no, s.department, `Sem ${s.semester}`], [], ['Code', 'Subject', 'Internal %', 'Assignment %', 'Semester/Model %', 'Overall %', 'Attendance %', 'Band'], ...d.subjects.map((x) => [x.code, x.name, x.internal ?? '', x.assignment ?? '', x.semester ?? '', x.overall ?? '', x.attendance ?? '', band(x.overall)]), [], ['Overall %', d.overall ?? '', 'Attendance %', d.attendance.pct ?? '', 'CGPA', d.cgpa ?? '', 'Class rank', `${d.rank}/${d.classSize}`], ['Fees total', d.fees.total, 'Paid', d.fees.paid, 'Pending', d.fees.pending]]);
  return (<>
    <div className="mb-4 flex justify-end gap-2"><button className="btn-secondary" onClick={csv}><Download className="h-4 w-4" />Download CSV</button><button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / Save as PDF</button></div>
    <div className="print-area space-y-5">
      <Card><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-iris-600">EduPulse · Academic report card</p><h2 className="mt-1 text-2xl font-bold">{s.name}</h2>
        <p className="text-sm text-slate-500">{s.roll_no} · {s.department} · Year {s.year}, Semester {s.semester} · Section {s.section}</p></div><p className="text-xs text-slate-400">Generated {fdate(d.generated_at)}</p></div></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Overall marks" value={pct(d.overall)} sub={`Band ${band(d.overall)}`} icon={Award} tone="iris" /><Stat label="Attendance" value={pct(d.attendance.pct)} sub={d.attendance.pct !== null && d.attendance.pct < 75 ? 'Below 75%' : 'Meets requirement'} subTone={d.attendance.pct !== null && d.attendance.pct < 75 ? 'text-rose-600' : 'text-emerald-600'} icon={CalendarCheck} tone="sky" />
        <Stat label="CGPA" value={d.cgpa ?? '—'} sub={`Class rank #${d.rank} of ${d.classSize}`} icon={GraduationCap} tone="navy" /><Stat label="Fees pending" value={inr(d.fees.pending)} sub={`${inr(d.fees.paid)} of ${inr(d.fees.total)} paid`} icon={Wallet} tone="amber" /></div>
      <Card title="Subject-wise performance" pad={false}>{!d.subjects.length ? <Empty title="No marks recorded yet" /> : (<TableWrap><thead><tr><th className="th">Subject</th><th className="th">Internal</th><th className="th">Assignment</th><th className="th">Semester/Model</th><th className="th">Overall</th><th className="th">Attendance</th><th className="th">Band</th></tr></thead>
        <tbody>{d.subjects.map((x) => (<tr key={x.id}><td className="td"><b className="font-semibold">{x.code}</b> <span className="text-slate-500">{x.name}</span></td>{[x.internal, x.assignment, x.semester].map((v, i) => <td key={i} className="td">{pct(v)}</td>)}<td className="td"><Badge tone={toneForPct(x.overall)}>{pct(x.overall)}</Badge></td><td className="td"><Badge tone={toneForPct(x.attendance)}>{pct(x.attendance)}</Badge></td><td className="td font-semibold">{band(x.overall)}</td></tr>))}</tbody></TableWrap>)}</Card>
      <div className="grid gap-5 lg:grid-cols-2"><Card title="Marks by subject"><BarC data={d.subjects.map((x) => ({ name: x.code, Marks: x.overall, Attendance: x.attendance }))} xKey="name" bars={[{ key: 'Marks', color: '#1d3a78' }, { key: 'Attendance', color: '#a28ff5' }]} domain={[0, 100]} h={220} /></Card>
        <Card title="Semester GPA">{d.semesters.length ? <ul className="divide-y divide-slate-100">{d.semesters.map((x) => <li key={x.semester} className="flex items-center justify-between py-2.5 text-sm"><span>Semester {x.semester}</span><span className="font-bold text-iris-600">{x.gpa}</span></li>)}</ul> : <Empty title="No published results" />}</Card></div>
      <Card title="Early-warning status">{!d.alerts.length ? <p className="text-sm text-emerald-700">No active warnings. Keep it up!</p> : <ul className="space-y-3">{d.alerts.map((a, i) => <li key={i} className="flex items-start gap-3 text-sm"><SeverityBadge severity={a.severity} /><span><b>{RULE[a.rule]}:</b> {a.reason}</span></li>)}</ul>}</Card>
    </div></>);
}

function ClassSummary({ mode }) {
  const [f, setF] = useState({ department: '', semester: '' });
  const { data: meta } = useApi('/meta');
  const { data, loading, error, reload } = useApi('/reports/class-summary' + (f.department || f.semester ? '?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString() : ''));
  const list = useMemo(() => (data ? (mode === 'shortage' ? data.students.filter((s) => s.attendance !== null && s.attendance < 75).sort((a, b) => a.attendance - b.attendance) : [...data.students].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))) : []), [data, mode]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  const csv = () => downloadCsv(mode === 'shortage' ? 'attendance-shortage.csv' : 'class-summary.csv', mode === 'shortage'
    ? [['Roll no', 'Student', 'Department', 'Semester', 'Attendance %', 'Overall marks %'], ...list.map((s) => [s.roll_no, s.name, s.department, s.semester, s.attendance, s.overall ?? ''])]
    : [['Rank', 'Roll no', 'Student', ...data.subjects, 'Overall %', 'Attendance %', 'CGPA', 'Pending fees', 'Open alerts'], ...list.map((s) => [s.rank ?? '', s.roll_no, s.name, ...data.subjects.map((c) => s.subjects[c] ?? ''), s.overall ?? '', s.attendance ?? '', s.cgpa ?? '', s.pending_fees, s.alerts])]);
  return (<>
    <div className="mb-4 flex flex-wrap items-center gap-3"><FilterSelect label="Department" value={f.department} onChange={(v) => setF({ ...f, department: v })}><option value="">All</option>{meta?.departments.map((x) => <option key={x}>{x}</option>)}</FilterSelect>
      <FilterSelect label="Semester" value={f.semester} onChange={(v) => setF({ ...f, semester: v })}><option value="">All</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</FilterSelect><button className="btn-secondary btn-sm ml-auto" onClick={csv} disabled={!list.length}><Download className="h-3.5 w-3.5" />Export CSV</button></div>
    {mode === 'shortage' && <div className="mb-4 grid gap-4 sm:grid-cols-3"><Stat label="Below 75% attendance" value={list.length} sub={`of ${data.students.length} students`} icon={AlertTriangle} tone="rose" /></div>}
    <Card pad={false}>{!list.length ? <Empty title={mode === 'shortage' ? 'No attendance shortage' : 'No students'} hint={mode === 'shortage' ? 'Everyone meets the 75% requirement.' : ''} /> : mode === 'shortage' ? (
      <TableWrap><thead><tr><th className="th">Student</th><th className="th">Department</th><th className="th w-1/3">Attendance</th><th className="th">Overall marks</th></tr></thead><tbody>{list.map((s) => (<tr key={s.id}><td className="td"><b className="font-semibold">{s.name}</b><span className="ml-1 text-xs text-slate-400">{s.roll_no}</span></td><td className="td">{s.department} · Sem {s.semester}</td><td className="td"><div className="flex items-center gap-3"><Progress value={s.attendance} className="flex-1" /><Badge tone="rose">{pct(s.attendance)}</Badge></div></td><td className="td">{pct(s.overall)}</td></tr>))}</tbody></TableWrap>) : (
      <TableWrap><thead><tr><th className="th">Rank</th><th className="th">Student</th>{data.subjects.map((c) => <th key={c} className="th text-center">{c}</th>)}<th className="th">Overall</th><th className="th">Attend.</th><th className="th">CGPA</th><th className="th">Fees due</th><th className="th">Alerts</th></tr></thead>
        <tbody>{list.map((s) => (<tr key={s.id}><td className="td font-semibold">{s.rank ?? '—'}</td><td className="td"><b className="font-semibold">{s.name}</b><span className="ml-1 text-xs text-slate-400">{s.roll_no}</span></td>{data.subjects.map((c) => <td key={c} className="td text-center">{s.subjects[c] !== undefined ? <Badge tone={toneForPct(s.subjects[c])}>{Math.round(s.subjects[c])}</Badge> : '—'}</td>)}
          <td className="td font-semibold">{pct(s.overall)}</td><td className="td"><Badge tone={toneForPct(s.attendance)}>{pct(s.attendance)}</Badge></td><td className="td">{s.cgpa ?? '—'}</td><td className="td">{s.pending_fees > 0 ? inr(s.pending_fees) : '—'}</td><td className="td">{s.alerts ? <Badge tone="rose">{s.alerts}</Badge> : '—'}</td></tr>))}</tbody></TableWrap>)}</Card></>);
}

export default function Reports() {
  const { user, isStaff } = useAuth();
  const [tab, setTab] = useState(isStaff ? 'gradebook' : 'card'); const [sid, setSid] = useState('');
  const { data: students } = useStudents(isStaff);
  const { data: subjects } = useApi(isStaff ? (user.role === 'teacher' ? '/subjects?mine=1' : '/subjects') : null, { skip: !isStaff });
  const mine = useMemo(() => (subjects || []).filter((s) => user.role === 'admin' || s.teacher_id === user.teacherId).sort((a, b) => b.semester - a.semester || a.code.localeCompare(b.code)), [subjects, user]);
  if (!isStaff) return (<><PageHeader title="Reports" subtitle="Your academic report card — download or print." /><ReportCard sid={user.studentId} /></>);
  return (<>
    <PageHeader title="Reports" subtitle="Live gradebook, report cards, class summaries and exports." actions={tab === 'card' && <StudentSelect students={students} value={sid} onChange={setSid} all="Select student…" />} />
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'gradebook', label: 'Live gradebook', icon: <Table2 className="h-4 w-4" /> }, { id: 'card', label: 'Student report card', icon: <FileText className="h-4 w-4" /> }, { id: 'class', label: 'Class summary', icon: <Users className="h-4 w-4" /> }, { id: 'shortage', label: 'Attendance shortage', icon: <AlertTriangle className="h-4 w-4" /> }]} />
    {tab === 'gradebook' && (mine.length ? <Gradebook key={mine[0].id} subjects={mine} /> : <Card><Empty title="No subjects assigned" /></Card>)}
    {tab === 'card' && <ReportCard sid={sid} />}
    {tab === 'class' && <ClassSummary mode="class" />}{tab === 'shortage' && <ClassSummary mode="shortage" />}
  </>);
}
