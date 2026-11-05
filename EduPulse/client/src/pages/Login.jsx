import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { PasswordInput } from '../components/PasswordFields.jsx';
import { Spinner } from '../lib/ui.jsx';

const DEMO = [['Admin', 'admin', 'Admin@123'], ['Teacher', 'teacher1', 'Teacher@123'], ['Student', 'student1', 'Student@123']];
export { AuthShell };

export default function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ identifier: '', password: '', remember: true });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [shake, setShake] = useState(0);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(f.identifier, f.password, f.remember); nav('/dashboard'); } catch (x) { setErr(x.message); setShake((n) => n + 1); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">Welcome back</h1><p className="mt-2 text-sm text-slate-500">Sign in with your email or username to continue.</p>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate={false}>
        <div><label className="label" htmlFor="id">Email or username</label><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="id" className="input pl-10" autoComplete="username" required value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} placeholder="you@college.edu" autoFocus /></div></div>
        <PasswordInput id="pw" label="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-iris-600" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} />Remember me for 30 days</label>
          <Link to="/forgot-password" className="text-sm font-semibold text-iris-600 hover:underline">Forgot password?</Link>
        </div>
        {err && <p key={shake} role="alert" className="flex animate-shake items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{err}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4 !text-white" /> : <>Sign in<ArrowRight className="h-4 w-4" /></>}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">New to EduPulse? <Link to="/signup" className="font-semibold text-iris-600 hover:underline">Create an account</Link></p>
      {import.meta.env.VITE_SHOW_DEMO !== 'false' && (
        <div className="mt-8 rounded-2xl border border-dashed border-iris-200 bg-iris-50/50 p-4"><p className="text-xs font-semibold text-iris-700">Demo accounts (sample data)</p>
          <div className="mt-3 flex flex-wrap gap-2">{DEMO.map(([l, u, p]) => <button key={l} type="button" onClick={() => setF({ ...f, identifier: u, password: p })} className="rounded-lg border border-iris-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-iris-50">{l}</button>)}</div>
          <p className="mt-2 text-[11px] text-slate-500">Click a role to fill the credentials, then Sign in.</p></div>)}
    </AuthShell>
  );
}
