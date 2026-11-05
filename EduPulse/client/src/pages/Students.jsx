import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Users, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Loading, ErrorState, PageHeader, Empty, Badge, TableWrap, Modal, Input, Select, FilterSelect, Avatar } from '../lib/ui.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { inr, pct, toneForPct } from '../lib/format.js';

const blank = { name: '', email: '', username: '', password: '', roll_no: '', department: '', year: 2, semester: 3, section: 'A' };
export default function Students() {
  const { user } = useAuth(); const toast = useToast(); const confirm = useConfirm(); const admin = user.role === 'admin';
  const [f, setF] = useState({ q: '', department: '', semester: '' }); const [q, setQ] = useState(''); const [form, setForm] = useState(null);
  const { data, loading, error, reload } = useApi('/students' + qs(f));
  const { data: meta } = useApi('/meta');
  const create = async () => { try { await api.post('/students', { ...form, year: Number(form.year), semester: Number(form.semester) }); toast('Student created'); setForm(null); reload(); } catch (e) { toast.error(e.message); } };
  const del = async (s) => { if (await confirm({ title: 'Delete student', message: `Permanently delete ${s.name} and all their records (attendance, marks, fees, results)?`, confirmText: 'Delete student' })) { try { await api.del(`/students/${s.id}`); toast('Student deleted'); reload(); } catch (e) { toast.error(e.message); } } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (<>
    <PageHeader title="Students" subtitle={admin ? 'All students in the institution.' : 'Students assigned to you.'} actions={admin && <button className="btn-primary" onClick={() => setForm({ ...blank, department: meta?.departments?.[0] || '' })}><Plus className="h-4 w-4" />Add student</button>} />
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <form className="relative" onSubmit={(e) => { e.preventDefault(); setF({ ...f, q }); }}><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input !w-64 pl-9" placeholder="Search name or roll no…" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setF({ ...f, q: '' }); }} /></form>
      <button className="btn-secondary btn-sm" onClick={() => setF({ ...f, q })}>Search</button>
      <FilterSelect label="Department" value={f.department} onChange={(v) => setF({ ...f, department: v })}><option value="">All</option>{meta?.departments.map((d) => <option key={d}>{d}</option>)}</FilterSelect>
      <FilterSelect label="Semester" value={f.semester} onChange={(v) => setF({ ...f, semester: v })}><option value="">All</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</FilterSelect></div>
    <Card pad={false}>{loading && !data ? <Loading /> : !data?.length ? <Empty title="No students found" hint={admin ? '' : 'Ask an administrator to assign students to you.'} /> : (
      <TableWrap><thead><tr><th className="th">Student</th><th className="th">Dept · Sem</th><th className="th">Attendance</th><th className="th">Avg marks</th><th className="th">Pending fees</th><th className="th">Alerts</th><th className="th text-right">Actions</th></tr></thead>
        <tbody>{data.map((s) => (<tr key={s.id}><td className="td"><div className="flex items-center gap-3"><Avatar name={s.name} /><div><Link to={`/students/${s.id}`} className="font-semibold text-navy-900 hover:text-iris-600">{s.name}</Link><p className="text-xs text-slate-400">{s.roll_no}</p></div></div></td>
          <td className="td text-xs">{s.department}<br /><span className="text-slate-400">Sem {s.semester}</span></td><td className="td"><Badge tone={toneForPct(s.attendance_pct)}>{pct(s.attendance_pct)}</Badge></td><td className="td"><Badge tone={toneForPct(s.avg_marks)}>{pct(s.avg_marks)}</Badge></td><td className="td">{s.pending_fees > 0 ? <span className="font-semibold text-amber-700">{inr(s.pending_fees)}</span> : <span className="text-slate-400">—</span>}</td>
          <td className="td">{s.open_alerts > 0 ? <Link to="/early-warning"><Badge tone="rose"><ShieldAlert className="h-3 w-3" />{s.open_alerts}</Badge></Link> : <Badge tone="emerald">None</Badge>}</td>
          <td className="td text-right"><Link to={`/students/${s.id}`} className="btn-ghost btn-sm">View</Link>{admin && <button className="btn-ghost btn-sm !text-rose-500" aria-label="Delete" onClick={() => del(s)}><Trash2 className="h-3.5 w-3.5" /></button>}</td></tr>))}</tbody></TableWrap>)}</Card>
    <p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Users className="h-3.5 w-3.5" />{data?.length ?? 0} students</p>
    <Modal open={!!form} onClose={() => setForm(null)} title="Add student" footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={create} disabled={!form?.name || !form?.email || !form?.username || !form?.password || !form?.roll_no || !form?.department}>Create</button></>}>
      {form && <div className="grid gap-4 sm:grid-cols-2"><Input label="Full name" className="sm:col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Input label="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="8+ chars with a letter and number" /><Input label="Roll number" value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} />
        <Input label="Department" list="dl" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /><datalist id="dl">{meta?.departments.map((d) => <option key={d} value={d} />)}</datalist><Input label="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
        <Select label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</Select><Select label="Semester" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</Select></div>}</Modal>
  </>);
}
