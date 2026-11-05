import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, RefreshCw, CheckCircle2, Eye, Send, Lightbulb, Wrench, User } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, SeverityBadge, Badge, FilterSelect, Modal, Textarea } from '../lib/ui.jsx';
import { PieC, BarC } from '../lib/charts.jsx';
import { useToast } from '../lib/toast.jsx';
import { ago } from '../lib/format.js';

const RULES = [['attendance', 'Low attendance'], ['marks', 'Low marks'], ['absence', 'Continuous absence'], ['performance', 'Performance decline'], ['assignments', 'Incomplete assignments'], ['fees', 'Overdue fees']];
const SEV_COLORS = { critical: '#f43f5e', high: '#fb923c', medium: '#f59e0b', low: '#38bdf8' };

export default function EarlyWarning() {
  const { user, isStaff } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ severity: 'all', rule: 'all', status: 'active' });
  const [busy, setBusy] = useState(false);
  const [remind, setRemind] = useState(null); const [msg, setMsg] = useState('');
  const { data, loading, error, reload } = useApi('/alerts' + qs(f));
  const act = async (fn, ok) => { try { await fn(); toast(ok); reload(); } catch (e) { toast.error(e.message); } };
  const scan = async () => { setBusy(true); try { const r = await api.post('/alerts/run'); toast(`Scan complete: ${r.created} new, ${r.resolved} resolved across ${r.students} students`); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const sev = data?.bySeverity || [];
  return (
    <>
      <PageHeader title={isStaff ? 'Early Warning System' : 'My alerts & suggestions'} subtitle={isStaff ? 'Automatic alerts for attendance, marks, absences, performance, assignments and fees.' : 'Personalised tips to help you stay on track.'}
        actions={isStaff && <button className="btn-primary" onClick={scan} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Run scan now</button>} />
      {isStaff && (<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sev.map((s) => (
        <button key={s.severity} onClick={() => setF({ ...f, severity: f.severity === s.severity ? 'all' : s.severity, status: 'active' })} className={`text-left transition ${f.severity === s.severity ? 'rounded-2xl ring-2 ring-iris-300' : ''}`}>
          <Stat label={`${s.severity} severity`} value={s.count} sub="Active alerts" icon={ShieldAlert} tone={{ critical: 'rose', high: 'amber', medium: 'amber', low: 'sky' }[s.severity]} /></button>))}</div>)}
      {isStaff && data && (<div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Alerts by type"><BarC data={data.byRule.map((r) => ({ name: r.label, count: r.count }))} xKey="name" bars={[{ key: 'count', name: 'Active alerts', color: '#7554dc' }]} unit="" h={220} /></Card>
        <Card title="Severity mix"><PieC data={sev.map((s) => ({ name: s.severity, value: s.count, fill: SEV_COLORS[s.severity] }))} unit="" h={220} /></Card></div>)}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <FilterSelect label="Type" value={f.rule} onChange={(v) => setF({ ...f, rule: v })}><option value="all">All types</option>{RULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</FilterSelect>
        <FilterSelect label="Severity" value={f.severity} onChange={(v) => setF({ ...f, severity: v })}><option value="all">All</option>{['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}</FilterSelect>
        <FilterSelect label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })}><option value="active">Active</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="all">All</option></FilterSelect>
      </div>
      {loading && !data ? <Loading /> : (
        <div className="mt-4 space-y-3">{data.items.length === 0 && <Card><Empty title="No alerts match" hint="Great news — nothing needs attention with these filters." /></Card>}
          {data.items.map((a) => (
            <div key={a.id} className="card overflow-hidden"><div className="flex">
              <span className={`w-1.5 shrink-0 ${{ critical: 'bg-rose-500', high: 'bg-orange-400', medium: 'bg-amber-400', low: 'bg-sky-400' }[a.severity]}`} />
              <div className="flex-1 p-5">
                <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={a.severity} /><Badge tone="navy">{a.rule_label}</Badge>{a.status !== 'open' && <Badge tone={a.status === 'resolved' ? 'emerald' : 'iris'}>{a.status}</Badge>}<span className="ml-auto text-[11px] text-slate-400">Updated {ago(a.updated_at)}</span></div>
                {isStaff && <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm"><User className="h-4 w-4 text-slate-400" /><Link to={`/students/${a.student_id}`} className="font-semibold text-navy-800 hover:text-iris-600">{a.student}</Link><span className="text-slate-500">{a.roll_no} · {a.department} · Sem {a.semester}</span></p>}
                <p className="mt-2 text-sm text-slate-700"><b className="text-slate-500">Reason: </b>{a.reason}</p>
                {isStaff ? <p className="mt-2 flex gap-2 rounded-xl bg-iris-50/60 p-3 text-sm text-navy-800"><Wrench className="mt-0.5 h-4 w-4 shrink-0 text-iris-500" /><span><b>Recommended action: </b>{a.recommended_action}</span></p>
                  : <p className="mt-2 flex gap-2 rounded-xl bg-iris-50/60 p-3 text-sm text-navy-800"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-iris-500" /><span><b>How to improve: </b>{a.student_tip}</span></p>}
                {isStaff && a.status !== 'resolved' && (<div className="mt-3 flex flex-wrap gap-2">
                  {a.status === 'open' && <button className="btn-secondary btn-sm" onClick={() => act(() => api.put(`/alerts/${a.id}`, { status: 'acknowledged' }), 'Alert acknowledged')}><Eye className="h-3.5 w-3.5" />Acknowledge</button>}
                  <button className="btn-secondary btn-sm" onClick={() => { setRemind(a); setMsg(''); }}><Send className="h-3.5 w-3.5" />Remind student</button>
                  <button className="btn-secondary btn-sm !text-emerald-700" onClick={() => act(() => api.put(`/alerts/${a.id}`, { status: 'resolved' }), 'Alert resolved')}><CheckCircle2 className="h-3.5 w-3.5" />Resolve</button></div>)}
                {isStaff && a.status === 'resolved' && <button className="btn-ghost btn-sm mt-3" onClick={() => act(() => api.put(`/alerts/${a.id}`, { status: 'open' }), 'Alert reopened')}>Reopen</button>}
              </div></div></div>))}</div>)}
      <Modal open={!!remind} onClose={() => setRemind(null)} title={`Remind ${remind?.student || ''}`} size="sm"
        footer={<><button className="btn-secondary" onClick={() => setRemind(null)}>Cancel</button><button className="btn-primary" onClick={() => act(async () => { await api.post(`/alerts/${remind.id}/remind`, { message: msg || undefined }); setRemind(null); }, 'Reminder sent to student')}>Send reminder</button></>}>
        <p className="mb-3 text-sm text-slate-600">The student will receive improvement suggestions for "{remind?.rule_label}". Add an optional personal note:</p>
        <Textarea label="Note (optional)" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={400} />
      </Modal>
    </>
  );
}
