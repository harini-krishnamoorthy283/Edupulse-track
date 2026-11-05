import { useState } from 'react';
import { Eye, EyeOff, Lock, Check, CircleAlert } from 'lucide-react';

export function scorePassword(p = '') {
  const checks = [[p.length >= 8, '8+ characters'], [/[a-z]/.test(p) && /[A-Z]/.test(p), 'Upper & lower case'], [/\d/.test(p), 'A number'], [/[^A-Za-z0-9]/.test(p), 'A symbol'], [p.length >= 12, '12+ characters']];
  const score = checks.filter(([ok]) => ok).length;
  return { checks, score, valid: p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p) };
}

export function PasswordInput({ id, label, value, onChange, autoComplete, placeholder = '••••••••', required = true, minLength }) {
  const [show, setShow] = useState(false); const [caps, setCaps] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id={id} className="input pl-10 pr-11" type={show ? 'text' : 'password'} autoComplete={autoComplete} required={required} minLength={minLength} value={value} placeholder={placeholder}
          onChange={onChange} onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') || false)} onBlur={() => setCaps(false)} />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-navy-700" onClick={() => setShow(!show)} aria-label={show ? 'Hide password text' : 'Show password text'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
      {caps && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600"><CircleAlert className="h-3.5 w-3.5" />Caps Lock is on</p>}
    </div>
  );
}

export function StrengthMeter({ password }) {
  const { checks, score } = scorePassword(password);
  const filled = !password ? 0 : [0, 1, 1, 2, 3, 4][score];
  const label = !password ? '' : score <= 2 ? 'Weak' : score === 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong';
  const color = score <= 2 ? 'bg-rose-500' : score === 3 ? 'bg-amber-500' : score === 4 ? 'bg-lime-500' : 'bg-emerald-500';
  return (
    <div className="mt-3" aria-live="polite">
      <div className="flex items-center gap-2"><div className="grid flex-1 grid-cols-4 gap-1.5">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 rounded-full transition-colors ${i <= filled ? color : 'bg-slate-100'}`} />)}</div><span className="w-12 text-right text-xs font-semibold text-slate-500">{label}</span></div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">{checks.map(([ok, t]) => <li key={t} className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-emerald-600' : 'text-slate-400'}`}><Check className={`h-3 w-3 ${ok ? '' : 'opacity-30'}`} />{t}</li>)}</ul>
    </div>
  );
}
