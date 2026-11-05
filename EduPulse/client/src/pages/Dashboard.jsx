import { Link } from 'react-router-dom';
import { Users, CalendarCheck, GraduationCap, Wallet, ShieldAlert, Award, ArrowRight, Activity, Bell, CalendarClock } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, SeverityBadge, Badge } from '../lib/ui.jsx';
import { AreaC, BarC, PieC, LineC } from '../lib/charts.jsx';
import { inr, pct, ago, fdate, cap } from '../lib/format.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const k = data.kpis; const student = user.role === 'student';
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <PageHeader title={`${greet}, ${user.name.split(' ')[0] === 'Dr.' || user.name.startsWith('Mr') || user.name.startsWith('Mrs') ? user.name.split(' ').slice(0, 2).join(' ') : user.name.split(' ')[0]}`}
        subtitle={student ? 'Here is your academic snapshot.' : user.role === 'teacher' ? 'Overview of your assigned students.' : 'Institution-wide overview.'}
        actions={<Link to="/early-warning" className="btn-secondary"><ShieldAlert className="h-4 w-4 text-rose-500" />{k.openAlerts} open alerts</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {student ? <Stat label="Class rank" value={k.rank ? `#${k.rank.rank}` : '—'} sub={k.rank ? `of ${k.rank.total} students` : 'No marks yet'} icon={Award} tone="iris" />
          : <Stat label="Total students" value={k.totalStudents} sub={user.role === 'teacher' ? 'Assigned to you' : 'Enrolled'} icon={Users} tone="iris" />}
        <Stat label="Attendance" value={pct(k.attendancePct)} sub={k.attendancePct !== null && k.attendancePct < 75 ? 'Below 75% requirement' : 'Meets requirement'} subTone={k.attendancePct !== null && k.attendancePct < 75 ? 'text-rose-600' : 'text-emerald-600'} icon={CalendarCheck} tone="sky" />
        <Stat label="Academic results" value={k.avgCgpa ?? '—'} sub={`${student ? 'CGPA' : 'Avg CGPA'} · marks avg ${pct(k.avgMarks)}`} icon={GraduationCap} tone="navy" />
        <Stat label="Pending fees" value={inr(k.pendingFees)} sub={k.overdueFees > 0 ? `${inr(k.overdueFees)} overdue` : 'Nothing overdue'} subTone={k.overdueFees > 0 ? 'text-rose-600' : 'text-emerald-600'} icon={Wallet} tone="amber" />
        <Stat label="Early warnings" value={k.openAlerts} sub={`${k.urgentAlerts} high / critical`} subTone={k.urgentAlerts ? 'text-rose-600' : 'text-slate-500'} icon={ShieldAlert} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Attendance trend" subtitle="Monthly attendance vs the 75% requirement" className="xl:col-span-2"><AreaC data={data.attendanceTrend} xKey="label" dataKey="pct" name="Attendance" minLine={75} /></Card>
        <Card title="Fee status" subtitle="Collected vs pending vs overdue"><PieC data={data.feeBreakdown} colors={['#10b981', '#f59e0b', '#f43f5e']} /></Card>
        <Card title="Subject performance" subtitle="Average marks and attendance by subject" className="xl:col-span-2"><BarC data={data.subjectPerformance} xKey="name" bars={[{ key: 'marks', name: 'Avg marks', color: '#1d3a78' }, { key: 'attendance', name: 'Attendance', color: '#a28ff5' }]} domain={[0, 100]} /></Card>
        <Card title="Performance trend" subtitle="Average score by assessment month"><LineC data={data.performanceTrend} xKey="label" lines={[{ key: 'avg', name: 'Avg score', color: '#7554dc' }]} /></Card>
        <Card title="Grade distribution" subtitle="Published semester results"><BarC data={data.gradeDistribution} xKey="grade" bars={[{ key: 'count', name: 'Grades', color: '#3a5fb3' }]} unit="" /></Card>
        {!student && data.departmentCompare.length > 1 ? <Card title="Department comparison" subtitle="Average marks"><BarC data={data.departmentCompare} xKey="name" bars={[{ key: 'marks', name: 'Avg marks', color: '#7554dc' }]} domain={[0, 100]} /></Card>
          : <Card title="Extracurricular activity" subtitle="By category"><PieC data={data.extracurricular} unit="" /></Card>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Early warnings" action={<Link to="/early-warning" className="text-xs font-semibold text-iris-600">View all</Link>} pad={false}>
          {data.topAlerts.length ? <ul className="divide-y divide-slate-100">{data.topAlerts.map((a) => (
            <li key={a.id} className="p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-navy-800">{student ? a.rule_label : `${a.student}`}</p><SeverityBadge severity={a.severity} /></div>
              {!student && <p className="text-[11px] text-slate-400">{a.rule_label} · {a.roll_no}</p>}<p className="mt-1 text-xs text-slate-500">{student ? a.student_tip : a.reason}</p></li>))}</ul>
            : <Empty title="No active warnings" hint="Everything looks on track." />}</Card>
        <Card title="Recent activities" pad={false} action={<Activity className="h-4 w-4 text-slate-400" />}>
          {data.activities.length ? <ul className="divide-y divide-slate-100">{data.activities.map((a) => (
            <li key={a.id} className="flex gap-3 p-4"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-iris-400" /><div className="min-w-0"><p className="text-sm text-slate-700">{a.detail}</p><p className="text-[11px] text-slate-400">{a.actor || 'System'} · {ago(a.created_at)}</p></div></li>))}</ul>
            : <Empty title="No recent activity" />}</Card>
        <Card title={student ? 'Upcoming deadlines' : 'Latest notifications'} pad={false} action={student ? <CalendarClock className="h-4 w-4 text-slate-400" /> : <Bell className="h-4 w-4 text-slate-400" />}>
          {student ? (data.upcoming.length ? <ul className="divide-y divide-slate-100">{data.upcoming.map((u, i) => (
            <li key={i} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-medium text-slate-700">{u.title}</p><p className="text-[11px] text-slate-400">{u.meta} · due {fdate(u.date)}</p></div><Badge tone={u.kind === 'fee' ? 'amber' : 'iris'}>{cap(u.kind)}</Badge></li>))}</ul> : <Empty title="No upcoming deadlines" />)
            : (data.notifications.length ? <ul className="divide-y divide-slate-100">{data.notifications.map((n) => (
              <li key={n.id} className="p-4"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-navy-800">{n.title}</p>{!n.is_read && <span className="h-2 w-2 rounded-full bg-iris-500" />}</div><p className="line-clamp-2 text-xs text-slate-500">{n.message}</p><p className="text-[11px] text-slate-400">{ago(n.created_at)}</p></li>))}</ul> : <Empty title="No notifications" />)}</Card>
        {student && <Card title="Latest notifications" className="lg:col-span-2 xl:col-span-3" pad={false} action={<Link to="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-iris-600">All <ArrowRight className="h-3 w-3" /></Link>}>
          <ul className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">{data.notifications.map((n) => (<li key={n.id} className="border-slate-100 p-4 md:border-t"><p className="truncate text-sm font-semibold text-navy-800">{n.title}</p><p className="line-clamp-2 text-xs text-slate-500">{n.message}</p><p className="text-[11px] text-slate-400">{ago(n.created_at)}</p></li>))}</ul></Card>}
      </div>
    </>
  );
}
