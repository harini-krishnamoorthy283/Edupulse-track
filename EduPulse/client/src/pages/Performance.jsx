import { useState } from 'react';
import { TrendingUp, TrendingDown, Award, CalendarCheck, Target, Minus } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Badge, StudentSelect, TableWrap, Progress, FilterSelect } from '../lib/ui.jsx';
import { LineC, BarC, PieC, RadarC } from '../lib/charts.jsx';
import { pct, monthLabel, toneForPct } from '../lib/format.js';

const BUCKET_COLORS = { 'Excellent (75+)': '#10b981', 'Good (60-74)': '#38bdf8', 'Average (45-59)': '#f59e0b', 'At risk (<45)': '#f43f5e', 'No data': '#cbd5e1' };
const Trend = ({ v }) => v === null || v === undefined ? <span className="text-slate-300">—</span> : v >= 3 ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><TrendingUp className="h-3.5 w-3.5" />+{v}</span> : v <= -3 ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><TrendingDown className="h-3.5 w-3.5" />{v}</span> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><Minus className="h-3.5 w-3.5" />{v}</span>;

export default function Performance() {
  const { isStaff } = useAuth();
  const [sid, setSid] = useState('');
  const { data: students } = useStudents(isStaff);
  const { data, loading, error, reload } = useApi('/performance' + qs({ student_id: sid }));
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const picker = isStaff && <StudentSelect students={students} value={sid} onChange={setSid} all="Class overview" />;
  if (loading && !data) return <Loading />;
  if (data.mode === 'overview') {
    const withScore = data.students.filter((s) => s.score !== null);
    const avg = withScore.length ? withScore.reduce((a, b) => a + b.score, 0) / withScore.length : null;
    return (<>
      <PageHeader title="Performance" subtitle="Progress and graphical analysis across your students." actions={picker} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Avg performance score" value={avg === null ? '—' : Math.round(avg * 10) / 10} sub="65% marks + 35% attendance" icon={Target} tone="iris" />
        <Stat label="Top performers" value={data.students.filter((s) => s.score >= 75).length} sub="Score 75+" icon={Award} tone="emerald" />
        <Stat label="At risk" value={data.students.filter((s) => s.score !== null && s.score < 45).length} sub="Score below 45" icon={TrendingDown} tone="rose" />
        <Stat label="Improving" value={data.students.filter((s) => s.trend >= 3).length} sub={`${data.students.filter((s) => s.trend <= -3).length} declining`} icon={TrendingUp} tone="sky" /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Performance mix"><PieC data={data.distribution.map((d) => ({ ...d, fill: BUCKET_COLORS[d.name] }))} unit="" /></Card>
        <Card title="Subject averages" className="lg:col-span-2"><BarC data={data.subjectAvg} xKey="code" bars={[{ key: 'avg', name: 'Average', color: '#1d3a78' }]} domain={[0, 100]} /></Card>
        <Card title="Score trend by month" className="lg:col-span-2"><LineC data={data.trend.map((t) => ({ ...t, label: monthLabel(t.month) }))} xKey="label" lines={[{ key: 'avg', name: 'Avg score', color: '#7554dc' }]} /></Card>
        <Card title="By assessment type"><BarC data={data.byType.map((t) => ({ name: t.type, avg: t.avg }))} xKey="name" bars={[{ key: 'avg', name: 'Average', color: '#a28ff5' }]} domain={[0, 100]} /></Card></div>
      <Card title="Student progress" className="mt-6" pad={false}>{!data.students.length ? <Empty title="No students" /> : (
        <TableWrap><thead><tr><th className="th">Student</th><th className="th">Marks</th><th className="th">Attendance</th><th className="th w-1/4">Score</th><th className="th">Trend</th><th className="th" /></tr></thead>
          <tbody>{data.students.sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).map((s) => (<tr key={s.id}><td className="td"><b className="font-semibold">{s.name}</b><span className="ml-1 text-xs text-slate-400">{s.roll_no}</span></td><td className="td"><Badge tone={toneForPct(s.avg_marks)}>{pct(s.avg_marks)}</Badge></td><td className="td"><Badge tone={toneForPct(s.attendance)}>{pct(s.attendance)}</Badge></td>
            <td className="td"><div className="flex items-center gap-3"><Progress value={s.score} className="flex-1" /><span className="w-10 text-xs font-semibold">{s.score ?? '—'}</span></div></td><td className="td"><Trend v={s.trend} /></td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => setSid(String(s.id))}>Details</button></td></tr>))}</tbody></TableWrap>)}</Card></>);
  }
  const radar = data.bySubject.map((s) => ({ name: s.code, mine: s.mine, class_avg: s.class_avg }));
  return (<>
    <PageHeader title="Performance" subtitle="Student progress and graphical analysis." actions={picker} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Performance score" value={data.score ?? '—'} sub="65% marks + 35% attendance" icon={Target} tone="iris" /><Stat label="Class rank" value={data.rank ? `#${data.rank}` : '—'} sub={data.classSize ? `of ${data.classSize} students` : ''} icon={Award} tone="emerald" />
      <Stat label="Average marks" value={pct(data.avgMarks)} sub={data.strongest ? `Strongest: ${data.strongest}` : ''} icon={TrendingUp} tone="navy" /><Stat label="Attendance" value={pct(data.attendance)} sub={data.weakest ? `Needs focus: ${data.weakest}` : ''} icon={CalendarCheck} tone="sky" /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card title="Progress over time" subtitle="Average score per month"><LineC data={data.trend.map((t) => ({ ...t, label: monthLabel(t.month) }))} xKey="label" lines={[{ key: 'avg', name: 'My average', color: '#7554dc' }]} /></Card>
      <Card title="Subject profile" subtitle="You vs class average"><RadarC data={radar} series={[{ key: 'mine', name: 'You', color: '#7554dc' }, { key: 'class_avg', name: 'Class avg', color: '#94acdf' }]} /></Card>
      <Card title="Subject comparison"><BarC data={data.bySubject.map((s) => ({ name: s.code, you: s.mine, class: s.class_avg }))} xKey="name" bars={[{ key: 'you', name: 'You', color: '#1d3a78' }, { key: 'class', name: 'Class average', color: '#bfb1fb' }]} domain={[0, 100]} /></Card>
      <Card title="By assessment type"><BarC data={data.byType.map((t) => ({ name: t.type, avg: t.avg }))} xKey="name" bars={[{ key: 'avg', name: 'Average', color: '#38bdf8' }]} domain={[0, 100]} /></Card></div></>);
}
