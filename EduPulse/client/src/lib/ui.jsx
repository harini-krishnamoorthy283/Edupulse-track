import { useEffect } from 'react';
import { X, Loader2, Inbox, AlertTriangle } from 'lucide-react';
import { initials } from './format.js';

export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={`animate-spin text-iris-500 ${className}`} />;
export const Loading = ({ label = 'Loading…' }) => (<div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><Spinner />{label}</div>);
export const ErrorState = ({ message, onRetry }) => (
  <div className="card p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-400" /><p className="mt-3 text-sm text-slate-600">{message || 'Something went wrong'}</p>
    {onRetry && <button className="btn-secondary btn-sm mt-4" onClick={onRetry}>Try again</button>}</div>
);
export const Empty = ({ title = 'Nothing here yet', hint, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center"><div className="rounded-2xl bg-iris-50 p-3"><Inbox className="h-6 w-6 text-iris-500" /></div>
    <p className="mt-3 text-sm font-semibold text-navy-800">{title}</p>{hint && <p className="mt-1 max-w-xs text-xs text-slate-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>
);
export const Card = ({ title, subtitle, action, children, className = '', pad = true }) => (
  <section className={`card ${className}`}>
    {(title || action) && (<header className="flex items-start justify-between gap-3 px-5 pt-5"><div><h3 className="text-[15px] font-semibold">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div>{action}</header>)}
    <div className={pad ? 'p-5' : ''}>{children}</div>
  </section>
);
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="text-2xl font-bold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
const TONES = {
  slate: 'bg-slate-100 text-slate-600', navy: 'bg-navy-50 text-navy-700', iris: 'bg-iris-50 text-iris-700', emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', sky: 'bg-sky-50 text-sky-700', orange: 'bg-orange-50 text-orange-700',
};
export const Badge = ({ tone = 'slate', children, className = '' }) => <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}>{children}</span>;
export const SEVERITY_TONE = { critical: 'rose', high: 'orange', medium: 'amber', low: 'sky' };
export const SeverityBadge = ({ severity }) => <Badge tone={SEVERITY_TONE[severity]} className="uppercase tracking-wide">{severity}</Badge>;
export const Avatar = ({ name, size = 'h-9 w-9 text-xs', tone = 'bg-iris-100 text-iris-700' }) => <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tone} ${size}`}>{initials(name)}</span>;

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', h); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full ${w} flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl`}>
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4"><h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
export const Field = ({ label, hint, children, className = '' }) => (<div className={className}><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}</div>);
export const Input = ({ label, hint, className, ...p }) => <Field label={label} hint={hint} className={className}><input className="input" {...p} /></Field>;
export const Textarea = ({ label, hint, className, ...p }) => <Field label={label} hint={hint} className={className}><textarea rows={3} className="input resize-none" {...p} /></Field>;
export const Select = ({ label, hint, className, children, ...p }) => <Field label={label} hint={hint} className={className}><select className="input pr-8" {...p}>{children}</select></Field>;
export const FilterSelect = ({ value, onChange, children, label, className = '' }) => (
  <label className={`flex items-center gap-2 text-xs text-slate-500 ${className}`}>{label && <span className="font-semibold">{label}</span>}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input !w-auto !py-2 pr-8 text-xs">{children}</select></label>
);
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white p-1 shadow-card" role="tablist">
    {tabs.map((t) => (<button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
      className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${value === t.id ? 'bg-navy-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-800'}`}>{t.icon}{t.label}{t.count !== undefined && <span className={`rounded-full px-1.5 text-[10px] ${value === t.id ? 'bg-white/20' : 'bg-slate-100'}`}>{t.count}</span>}</button>))}
  </div>
);
export const Chips = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">{options.map((o) => (<button key={o.value} onClick={() => onChange(o.value)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${value === o.value ? 'border-iris-300 bg-iris-50 text-iris-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{o.label}</button>))}</div>
);
const STAT_TONES = { navy: 'bg-navy-50 text-navy-700', iris: 'bg-iris-100 text-iris-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', sky: 'bg-sky-50 text-sky-600' };
export const Stat = ({ label, value, sub, icon: Icon, tone = 'navy', subTone }) => (
  <div className="card p-5"><div className="flex items-start justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 truncate text-2xl font-bold text-navy-900">{value}</p>{sub && <p className={`mt-1 text-xs ${subTone || 'text-slate-500'}`}>{sub}</p>}</div>
    {Icon && <span className={`rounded-xl p-2.5 ${STAT_TONES[tone]}`}><Icon className="h-5 w-5" /></span>}</div></div>
);
export const Progress = ({ value, tone, className = '' }) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const c = tone || (v >= 75 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-rose-500');
  return <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}><div className={`h-full rounded-full transition-all ${c}`} style={{ width: `${v}%` }} /></div>;
};
export const TableWrap = ({ children }) => <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse">{children}</table></div>;
export const StudentSelect = ({ students, value, onChange, all = 'All students', className = '' }) => (
  <FilterSelect value={value} onChange={onChange} label="Student" className={className}>
    <option value="">{all}</option>{(students || []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>)}
  </FilterSelect>
);
export const RatingStars = ({ value, onChange, size = 'h-6 w-6' }) => (
  <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
    <button type="button" key={n} onClick={() => onChange?.(n)} disabled={!onChange} aria-label={`${n} star`} className="disabled:cursor-default">
      <svg viewBox="0 0 24 24" className={`${size} ${n <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`}><path stroke="currentColor" strokeWidth="1" d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
    </button>))}</div>
);
