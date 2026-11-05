import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldX, CheckCircle2, Check, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { AuthShell } from '../components/AuthShell.jsx';
import { PasswordInput, StrengthMeter, scorePassword } from '../components/PasswordFields.jsx';
import { Loading, Spinner } from '../lib/ui.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams(); const token = params.get('token') || ''; const nav = useNavigate();
  const [state, setState] = useState('checking'); const [f, setF] = useState({ password: '', confirm: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`).then((r) => setState(r.valid ? 'form' : 'invalid')).catch(() => setState('invalid')); }, [token]);
  const match = f.confirm && f.password === f.confirm;
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!scorePassword(f.password).valid) return setErr('Password needs 8+ characters with a letter and a number');
    if (!match) return setErr('Passwords do not match');
    setBusy(true); try { await api.post('/auth/reset-password', { token, password: f.password }); setState('done'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      {state === 'checking' && <Loading label="Checking your link…" />}
      {state === 'invalid' && (<div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50"><ShieldX className="h-8 w-8 text-rose-500" /></span><h1 className="mt-5 text-3xl font-bold">Link expired</h1>
        <p className="mt-3 text-sm text-slate-500">This reset link is invalid, already used, or has expired. Request a new one to continue.</p><Link to="/forgot-password" className="btn-primary mt-6 w-full">Request a new link</Link></div>)}
      {state === 'done' && (<div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50"><CheckCircle2 className="h-8 w-8 text-emerald-600" /></span><h1 className="mt-5 text-3xl font-bold">Password updated</h1>
        <p className="mt-3 text-sm text-slate-500">Your password was changed and every other device has been signed out. Sign in with your new password.</p><button className="btn-primary mt-6 w-full" onClick={() => nav('/login')}>Go to sign in</button></div>)}
      {state === 'form' && (<><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-iris-50"><ShieldCheck className="h-6 w-6 text-iris-600" /></span><h1 className="mt-5 text-3xl font-bold">Choose a new password</h1><p className="mt-2 text-sm text-slate-500">Pick something strong that you don't use anywhere else.</p>
        <form onSubmit={submit} className="mt-8 space-y-5"><div><PasswordInput id="rp-pw" label="New password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" minLength={8} /><StrengthMeter password={f.password} /></div>
          <div><PasswordInput id="rp-cf" label="Confirm new password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" />
            {f.confirm && <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${match ? 'text-emerald-600' : 'text-rose-600'}`}>{match ? <><Check className="h-3.5 w-3.5" />Passwords match</> : <><X className="h-3.5 w-3.5" />Passwords do not match</>}</p>}</div>
          {err && <p role="alert" className="animate-shake rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</p>}
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4 !text-white" /> : 'Update password'}</button></form></>)}
    </AuthShell>
  );
}
