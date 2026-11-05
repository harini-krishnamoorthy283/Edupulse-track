import { useState } from 'react';
import { Plus, Radio, Download } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { Card, Stat, Loading, ErrorState, Empty, FilterSelect, TableWrap, Modal, Input, Select, Badge } from '../lib/ui.jsx';
import { useToast } from '../lib/toast.jsx';
import { downloadCsv } from '../lib/csv.js';
import { today, pct, fdate, toneForPct, cap } from '../lib/format.js';

// Spreadsheet-style live gradebook: type a score, leave the cell (Tab/Enter) and it is saved instantly for every viewer.
export default function Gradebook({ subjects }) {
  const toast = useToast();
  const [sub, setSub] = useState(subjects[0]?.id || '');
  const { data, loading, error, reload } = useApi(sub ? `/reports/marksheet?subject_id=${sub}` : null, { skip: !sub });
  const [drafts, setDrafts] = useState({}); const [extra, setExtra] = useState([]); const [colForm, setColForm] = useState(null); const [saving, setSaving] = useState('');
  if (!subjects.length) return <Card><Empty title="No subjects assigned" hint="Ask an administrator to assign subjects to you." /></Card>;
  const cols = data ? [...data.columns, ...extra.filter((e) => !data.columns.some((c) => c.key === e.key))] : [];
  const edit = data?.canEdit;
  const commit = async (row, col) => {
    const k = `${row.student_id}|${col.key}`; const v = drafts[k];
    if (v === undefined) return;
    const existing = row.cells[col.key];
    if (v === '' || Number(v) === existing?.score) { setDrafts(({ [k]: _, ...rest }) => rest); return; }
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || n > col.max_score) { toast.error(`Score must be between 0 and ${col.max_score}`); return; }
    setSaving(k);
    try {
      if (existing) await api.put(`/marks/${existing.id}`, { title: col.title, score: n, max_score: col.max_score, exam_date: col.exam_date, type: col.type });
      else await api.post('/marks', { student_id: row.student_id, subject_id: Number(sub), type: col.type, title: col.title, score: n, max_score: col.max_score, exam_date: col.exam_date });
      setDrafts(({ [k]: _, ...rest }) => rest); await reload();
    } catch (e) { toast.error(e.message); } finally { setSaving(''); }
  };
  const addCol = () => {
    const c = { type: colForm.type, title: colForm.title.trim(), max_score: Number(colForm.max_score), exam_date: colForm.exam_date };
    c.key = `${c.type}|${c.title}|${c.max_score}|${c.exam_date}`; setExtra([...extra, c]); setColForm(null); toast('Column added — type scores into it to save them');
  };
  const exportCsv = () => downloadCsv(`${data.subject.code}-marksheet.csv`, [['Roll no', 'Student', ...cols.map((c) => `${c.title} (/${c.max_score})`), 'Total', 'Max', 'Percent'], ...data.rows.map((r) => [r.roll_no, r.name, ...cols.map((c) => r.cells[c.key]?.score ?? ''), r.total, r.max, r.percent ?? ''])]);
  return (<>
    <div className="mb-4 flex flex-wrap items-center gap-3"><FilterSelect label="Subject" value={sub} onChange={(v) => { setSub(v); setExtra([]); setDrafts({}); }}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</FilterSelect>
      <Badge tone="emerald"><Radio className="h-3 w-3" />Live — edits appear instantly for everyone</Badge>
      <span className="ml-auto flex gap-2"><button className="btn-secondary btn-sm" onClick={exportCsv} disabled={!data}><Download className="h-3.5 w-3.5" />Export CSV</button>
        {edit && <button className="btn-primary btn-sm" onClick={() => setColForm({ type: 'internal', title: '', max_score: 50, exam_date: today() })}><Plus className="h-3.5 w-3.5" />New assessment</button>}</span></div>
    {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Loading /> : (<>
      <div className="grid gap-4 sm:grid-cols-4"><Stat label="Class average" value={pct(data.stats.average)} tone="iris" /><Stat label="Highest" value={pct(data.stats.highest)} tone="emerald" /><Stat label="Lowest" value={pct(data.stats.lowest)} tone="rose" /><Stat label="Pass rate (≥40%)" value={pct(data.stats.passRate)} tone="sky" /></div>
      {!edit && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">View only — this subject is taught by another teacher, so only they (or an admin) can edit these marks.</p>}
      <Card className="mt-5" pad={false}>{!data.rows.length ? <Empty title="No students" hint="No students assigned to you in this subject's department and semester." /> : (
        <TableWrap><thead><tr><th className="th sticky left-0 bg-slate-50">Student</th>{cols.map((c) => <th key={c.key} className="th text-center"><span className="block">{c.title}</span><span className="block font-normal normal-case text-slate-400">{cap(c.type)} · /{c.max_score} · {fdate(c.exam_date).slice(0, 6)}</span></th>)}<th className="th text-center">Total</th><th className="th text-center">%</th></tr></thead>
          <tbody>{data.rows.map((r) => (<tr key={r.student_id}><td className="td sticky left-0 bg-white"><b className="font-semibold">{r.name}</b><span className="ml-1 text-xs text-slate-400">{r.roll_no}</span></td>
            {cols.map((c) => { const k = `${r.student_id}|${c.key}`; const existing = r.cells[c.key]; const val = drafts[k] ?? existing?.score ?? '';
              return (<td key={c.key} className="td text-center"><input type="number" min="0" max={c.max_score} step="0.5" disabled={!edit} aria-label={`${r.name} ${c.title}`} value={val}
                onChange={(e) => setDrafts({ ...drafts, [k]: e.target.value })} onBlur={() => commit(r, c)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className={`w-20 rounded-lg border px-2 py-1.5 text-center text-sm outline-none transition focus:border-iris-400 focus:ring-4 focus:ring-iris-100 ${drafts[k] !== undefined ? 'border-amber-300 bg-amber-50' : saving === k ? 'border-iris-300' : 'border-slate-200'} disabled:bg-slate-50`} /></td>); })}
            <td className="td text-center font-semibold">{r.total}<span className="text-xs font-normal text-slate-400">/{r.max}</span></td><td className="td text-center"><Badge tone={toneForPct(r.percent)}>{pct(r.percent)}</Badge></td></tr>))}</tbody></TableWrap>)}</Card>
      {edit && <p className="mt-3 text-xs text-slate-400">Tip: type a score, then press Enter or Tab — it is saved immediately, alerts and reports update live.</p>}</>)}
    <Modal open={!!colForm} onClose={() => setColForm(null)} title="New assessment column" size="sm" footer={<><button className="btn-secondary" onClick={() => setColForm(null)}>Cancel</button><button className="btn-primary" disabled={!colForm?.title?.trim() || !(Number(colForm?.max_score) > 0)} onClick={addCol}>Add column</button></>}>
      {colForm && <div className="grid gap-4 sm:grid-cols-2"><Input label="Title" className="sm:col-span-2" placeholder="CAT 4" value={colForm.title} onChange={(e) => setColForm({ ...colForm, title: e.target.value })} />
        <Select label="Type" value={colForm.type} onChange={(e) => setColForm({ ...colForm, type: e.target.value })}><option value="internal">Internal</option><option value="assignment">Assignment</option><option value="semester">Semester / Model</option></Select><Input label="Out of" type="number" min="1" value={colForm.max_score} onChange={(e) => setColForm({ ...colForm, max_score: e.target.value })} />
        <Input label="Date" type="date" className="sm:col-span-2" value={colForm.exam_date} onChange={(e) => setColForm({ ...colForm, exam_date: e.target.value })} /></div>}</Modal>
  </>);
}
