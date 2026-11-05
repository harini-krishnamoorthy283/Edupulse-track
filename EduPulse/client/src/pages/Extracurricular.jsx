import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Trophy, Medal, Flag, Sparkles, Dumbbell } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useStudents } from '../lib/hooks.js';
import { api, qs } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, PageHeader, Empty, Badge, StudentSelect, Modal, Input, Select, Textarea, Chips } from '../lib/ui.jsx';
import { PieC, BarC } from '../lib/charts.jsx';
import { useToast, useConfirm } from '../lib/toast.jsx';
import { fdate, today, cap, monthLabel } from '../lib/format.js';

const CATS = { sports: [Dumbbell, 'emerald'], event: [Flag, 'sky'], competition: [Trophy, 'amber'], achievement: [Medal, 'iris'] };
const LEVELS = ['college', 'inter-college', 'state', 'national', 'international'];
const blank = () => ({ student_id: '', category: 'sports', title: '', description: '', level: 'college', result: '', event_date: today() });

export default function Extracurricular() {
  const { user, isStaff } = useAuth(); const toast = useToast(); const confirm = useConfirm();
  const [f, setF] = useState({ student_id: '', category: '' }); const [form, setForm] = useState(null);
  const { data: students } = useStudents(isStaff);
  const { data, loading, error, reload } = useApi('/extracurricular' + qs(f));
  const stats = useMemo(() => { const l = data || []; const by = (c) => l.filter((x) => x.category === c).length;
    const months = {}; l.forEach((x) => { const k = x.event_date.slice(0, 7); months[k] = (months[k] || 0) + 1; });
    const lv = {}; l.forEach((x) => { lv[x.level] = (lv[x.level] || 0) + 1; });
    return { by, pie: Object.keys(CATS).map((c) => ({ name: cap(c), value: by(c) })), months: Object.entries(months).sort().map(([k, v]) => ({ name: monthLabel(k), count: v })), levels: LEVELS.map((x) => ({ name: x, count: lv[x] || 0 })) }; }, [data]);
  const save = async () => {
    const body = { category: form.category, title: form.title, description: form.description || null, level: form.level, result: form.result || null, event_date: form.event_date };
    try { if (form.id) await api.put(`/extracurricular/${form.id}`, body); else await api.post('/extracurricular', { ...body, student_id: form.student_id ? Number(form.student_id) : undefined }); toast(form.id ? 'Entry updated' : 'Entry added'); setForm(null); reload(); } catch (e) { toast.error(e.message); }
  };
  const del = async (x) => { if (await confirm({ title: 'Delete entry', message: `Delete "${x.title}"?`, confirmText: 'Delete' })) { try { await api.del(`/extracurricular/${x.id}`); toast('Entry deleted'); reload(); } catch (e) { toast.error(e.message); } } };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (<>
    <PageHeader title="Extracurricular" subtitle="Sports, events, competitions and achievements." actions={<>{isStaff && <StudentSelect students={students} value={f.student_id} onChange={(v) => setF({ ...f, student_id: v })} />}<button className="btn-primary" onClick={() => setForm(blank())}><Plus className="h-4 w-4" />Add entry</button></>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(CATS).map(([c, [Ic, tone]]) => <Stat key={c} label={cap(c)} value={stats.by(c)} sub={c === 'event' ? 'Events attended' : 'Entries'} icon={Ic} tone={tone === 'iris' ? 'iris' : tone} />)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-3"><Card title="By category"><PieC data={stats.pie} unit="" h={220} /></Card><Card title="Participation over time"><BarC data={stats.months} xKey="name" bars={[{ key: 'count', name: 'Entries', color: '#7554dc' }]} unit="" h={220} /></Card><Card title="By level"><BarC data={stats.levels} xKey="name" bars={[{ key: 'count', name: 'Entries', color: '#1d3a78' }]} unit="" h={220} /></Card></div>
    <div className="my-5"><Chips value={f.category} onChange={(v) => setF({ ...f, category: v })} options={[{ value: '', label: 'All' }, ...Object.keys(CATS).map((c) => ({ value: c, label: cap(c) }))]} /></div>
    {loading && !data ? <Loading /> : !data?.length ? <Card><Empty title="No entries yet" hint="Add sports, events, competitions or achievements." action={<button className="btn-primary btn-sm" onClick={() => setForm(blank())}>Add entry</button>} /></Card> : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((x) => { const [Ic, tone] = CATS[x.category]; return (
        <div key={x.id} className="card p-5"><div className="flex items-start gap-3"><span className={`rounded-xl p-2.5 ${{ emerald: 'bg-emerald-50 text-emerald-600', sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', iris: 'bg-iris-100 text-iris-600' }[tone]}`}><Ic className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{x.title}</p>{isStaff && <p className="text-xs text-slate-500">{x.student} · {x.roll_no}</p>}<p className="text-xs text-slate-400">{fdate(x.event_date)}</p></div></div>
          {x.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{x.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={tone}>{cap(x.category)}</Badge><Badge tone="navy">{cap(x.level)}</Badge>{x.result && <Badge tone="iris"><Sparkles className="h-3 w-3" />{x.result}</Badge>}
            <span className="ml-auto"><button className="btn-ghost btn-sm" aria-label="Edit" onClick={() => setForm({ ...x })}><Pencil className="h-3.5 w-3.5" /></button><button className="btn-ghost btn-sm !text-rose-500" aria-label="Delete" onClick={() => del(x)}><Trash2 className="h-3.5 w-3.5" /></button></span></div></div>); })}</div>)}
    <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit entry' : 'Add entry'} footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={!form?.title || form.title.length < 2 || (isStaff && !form.id && !form.student_id)} onClick={save}>Save</button></>}>
      {form && <div className="grid gap-4 sm:grid-cols-2">
        {isStaff && !form.id && <Select label="Student" className="sm:col-span-2" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Select student…</option>{students?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>)}</Select>}
        <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.keys(CATS).map((c) => <option key={c} value={c}>{cap(c)}</option>)}</Select>
        <Select label="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</Select>
        <Input label="Title" className="sm:col-span-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><Input label="Result / position" value={form.result || ''} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="Winner, Runner-up…" /><Input label="Date" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
        <Textarea label="Description" className="sm:col-span-2" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>}</Modal>
  </>);
}
