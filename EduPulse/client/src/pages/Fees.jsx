import { useState } from 'react';
import { Wallet, CheckCircle2, Clock, AlertTriangle, Plus, Pencil, Trash2, CreditCard, Receipt, Printer, IndianRupee } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Badge, StudentSelect, TableWrap, Modal, Input, Select, FilterSelect, Tabs, Progress } from '../lib/ui.jsx';
import { PieC, BarC } from '../lib/charts.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { inr, fdate, cap, today } from '../lib/format.js';

const CATS = ['tuition', 'exam', 'hostel', 'transport', 'library', 'other'];
const STATUS = { paid: ['emerald', 'Paid'], partial: ['sky', 'Partial'], pending: ['amber', 'Pending'], overdue: ['rose', 'Overdue'] };

export default function Fees() {
  const { user, isStaff } = useAuth(); const toast = useToast(); const confirm = useConfirm(); const admin = user.role === 'admin';
  const [tab, setTab] = useState('fees'); const [f, setF] = useState({ student_id: '', status: '', category: '' });
  const [pay, setPay] = useState(null); const [form, setForm] = useState(null); const [receipt, setReceipt] = useState(null);
  const { data: students } = useStudents(isStaff);
  const { data: meta } = useApi('/meta', { skip: !admin });
  const { data, loading, error, reload } = useApi('/fees' + qs(f));
  const { data: hist, reload: reloadHist } = useApi('/fees/payments' + qs({ student_id: f.student_id }));
  const refresh = () => { reload(); reloadHist(); };
  const doPay = async () => { try { const r = await api.post(`/fees/${pay.id}/payments`, { amount: Number(pay.amount), method: pay.method }); toast(`Payment received. Receipt ${r.receipt_no}`); setPay(null); refresh(); } catch (e) { toast.error(e.message); } };
  const saveFee = async () => {
    const b = { title: form.title, category: form.category, amount: Number(form.amount), due_date: form.due_date };
    try { if (form.id) await api.put(`/fees/${form.id}`, b); else await api.post('/fees', { ...b, ...(form.target === 'student' ? { student_id: Number(form.student_id) } : form.target === 'department' ? { department: form.department } : { all: true }) }); toast(form.id ? 'Fee updated' : 'Fee created'); setForm(null); refresh(); } catch (e) { toast.error(e.message); }
  };
  const del = async (x) => { if (await confirm({ title: 'Delete fee', message: `Delete "${x.title}"${isStaff ? ` for ${x.student}` : ''}? Its payments will be removed too.`, confirmText: 'Delete' })) { try { await api.del(`/fees/${x.id}`); toast('Fee deleted'); refresh(); } catch (e) { toast.error(e.message); } } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const t = data?.totals;
  return (<>
    <PageHeader title="Fees" subtitle="Payments, pending amounts and payment history." actions={<>{isStaff && <StudentSelect students={students} value={f.student_id} onChange={(v) => setF({ ...f, student_id: v })} />}{admin && <button className="btn-primary" onClick={() => setForm({ target: 'student', student_id: '', department: '', title: '', category: 'tuition', amount: '', due_date: today() })}><Plus className="h-4 w-4" />Add fee</button>}</>} />
    {loading && !data ? <Loading /> : (<>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total fees" value={inr(t.total)} icon={Wallet} tone="navy" /><Stat label="Paid" value={inr(t.paid)} sub={t.total ? `${Math.round((100 * t.paid) / t.total)}% collected` : ''} icon={CheckCircle2} tone="emerald" /><Stat label="Pending" value={inr(t.pending)} icon={Clock} tone="amber" /><Stat label="Overdue" value={inr(t.overdue)} sub={t.overdue ? 'Needs attention' : 'All clear'} subTone={t.overdue ? 'text-rose-600' : 'text-emerald-600'} icon={AlertTriangle} tone="rose" /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3"><Card title="Payment status"><PieC data={[{ name: 'Paid', value: t.paid }, { name: 'Pending', value: t.pending - t.overdue }, { name: 'Overdue', value: t.overdue }]} colors={['#10b981', '#f59e0b', '#f43f5e']} unit="" /></Card>
        <Card title="By category" className="lg:col-span-2"><BarC data={data.byCategory.map((c) => ({ name: cap(c.category), Paid: c.paid, Pending: c.pending }))} xKey="name" bars={[{ key: 'Paid', color: '#10b981' }, { key: 'Pending', color: '#f59e0b' }]} stacked unit="" /></Card></div>
      <div className="mt-6"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'fees', label: 'Fees & dues', icon: <Wallet className="h-4 w-4" />, count: data.fees.length }, { id: 'history', label: 'Payment history', icon: <Receipt className="h-4 w-4" />, count: hist?.length }]} /></div>
      {tab === 'fees' && (<><div className="mb-4 flex flex-wrap gap-3"><FilterSelect label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })}><option value="">All</option>{Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</FilterSelect>
        <FilterSelect label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })}><option value="">All</option>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</FilterSelect></div>
        <Card pad={false}>{!data.fees.length ? <Empty title="No fees found" /> : (<TableWrap><thead><tr>{isStaff && <th className="th">Student</th>}<th className="th">Fee</th><th className="th">Due</th><th className="th">Amount</th><th className="th w-40">Paid</th><th className="th">Pending</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
          <tbody>{data.fees.map((x) => (<tr key={x.id}>{isStaff && <td className="td"><b className="font-semibold">{x.student}</b><span className="ml-1 text-xs text-slate-400">{x.roll_no}</span></td>}<td className="td"><p className="font-medium">{x.title}</p><p className="text-[11px] text-slate-400">{cap(x.category)}</p></td><td className="td">{fdate(x.due_date)}</td><td className="td">{inr(x.amount)}</td>
            <td className="td"><Progress value={(100 * x.paid) / x.amount} tone="bg-emerald-500" /><span className="text-[11px] text-slate-500">{inr(x.paid)}</span></td><td className="td font-semibold">{inr(x.pending)}</td><td className="td"><Badge tone={STATUS[x.status][0]}>{STATUS[x.status][1]}</Badge></td>
            <td className="td text-right">{x.pending > 0 && (user.role === 'student' || admin) && <button className="btn-accent btn-sm" onClick={() => setPay({ ...x, amount: x.pending, method: admin ? 'cash' : 'upi' })}><CreditCard className="h-3.5 w-3.5" />{admin ? 'Record' : 'Pay'}</button>}
              {admin && <><button className="btn-ghost btn-sm" aria-label="Edit" onClick={() => setForm({ ...x, target: 'edit' })}><Pencil className="h-3.5 w-3.5" /></button><button className="btn-ghost btn-sm !text-rose-500" aria-label="Delete" onClick={() => del(x)}><Trash2 className="h-3.5 w-3.5" /></button></>}</td></tr>))}</tbody></TableWrap>)}</Card></>)}
      {tab === 'history' && <Card pad={false}>{!hist?.length ? <Empty title="No payments yet" /> : (<TableWrap><thead><tr><th className="th">Receipt</th>{isStaff && <th className="th">Student</th>}<th className="th">Fee</th><th className="th">Date</th><th className="th">Method</th><th className="th">Amount</th><th className="th" /></tr></thead>
        <tbody>{hist.map((p) => (<tr key={p.id}><td className="td font-mono text-xs">{p.receipt_no}</td>{isStaff && <td className="td">{p.student}</td>}<td className="td">{p.title}</td><td className="td">{fdate(p.paid_on)}</td><td className="td"><Badge tone="navy">{p.method.toUpperCase()}</Badge></td><td className="td font-semibold text-emerald-700">{inr(p.amount)}</td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => setReceipt(p)}><Receipt className="h-3.5 w-3.5" />Receipt</button></td></tr>))}</tbody></TableWrap>)}</Card>}
    </>)}
    <Modal open={!!pay} onClose={() => setPay(null)} title={admin ? 'Record payment' : 'Pay fee'} size="sm" footer={<><button className="btn-secondary" onClick={() => setPay(null)}>Cancel</button><button className="btn-primary" disabled={!pay?.amount || Number(pay.amount) <= 0 || Number(pay.amount) > pay.pending} onClick={doPay}><IndianRupee className="h-4 w-4" />{admin ? 'Record' : 'Pay'} {pay && inr(pay.amount)}</button></>}>
      {pay && <div className="space-y-4"><div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold text-navy-900">{pay.title}</p><p className="text-slate-500">Pending balance: <b>{inr(pay.pending)}</b></p></div>
        <Input label="Amount (₹)" type="number" min="1" max={pay.pending} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} hint="You can pay part of the balance." />
        <Select label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="upi">UPI</option><option value="card">Card</option><option value="netbanking">Net banking</option>{admin && <><option value="cash">Cash</option><option value="cheque">Cheque</option></>}</Select>
        {!admin && <p className="text-[11px] text-slate-400">Demo payment: no real money is moved; the payment is recorded and a receipt is issued.</p>}</div>}</Modal>
    <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit fee' : 'Add fee'} footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={saveFee} disabled={!form?.title || !form?.amount || (form?.target === 'student' && !form.student_id) || (form?.target === 'department' && !form.department)}>Save</button></>}>
      {form && <div className="grid gap-4 sm:grid-cols-2">
        {!form.id && <><Select label="Apply to" className="sm:col-span-2" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="student">One student</option><option value="department">A department</option><option value="all">All students</option></Select>
          {form.target === 'student' && <Select label="Student" className="sm:col-span-2" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Select…</option>{students?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>)}</Select>}
          {form.target === 'department' && <Select label="Department" className="sm:col-span-2" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option value="">Select…</option>{meta?.departments.map((d) => <option key={d}>{d}</option>)}</Select>}</>}
        <Input label="Title" className="sm:col-span-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</Select>
        <Input label="Amount (₹)" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><Input label="Due date" type="date" className="sm:col-span-2" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>}</Modal>
    <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Payment receipt" size="sm" footer={<><button className="btn-secondary" onClick={() => setReceipt(null)}>Close</button><button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button></>}>
      {receipt && <div className="print-area text-sm"><div className="mb-4 text-center"><p className="text-lg font-bold text-navy-900">EduPulse</p><p className="text-xs text-slate-500">Fee payment receipt</p></div>
        <dl className="space-y-2">{[['Receipt no', receipt.receipt_no], ['Student', `${receipt.student} (${receipt.roll_no})`], ['Fee', receipt.title], ['Date', fdate(receipt.paid_on)], ['Method', receipt.method.toUpperCase()]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-navy-900">{v}</dd></div>)}</dl>
        <p className="mt-4 text-right text-xl font-bold text-emerald-700">{inr(receipt.amount)}</p></div>}</Modal>
  </>);
}
