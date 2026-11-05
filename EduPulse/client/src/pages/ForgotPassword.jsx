import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { AuthShell } from '../components/AuthShell.jsx';
import { Spinner } from '../lib/ui.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(null);
  const submit = async (e) => { e.preventDefault(); setErr(''); setBusy(true); try { setDone(await api.post('/auth/forgot-password', { email })); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  if (done) {
    const dev = done.devResetLink ? '/reset-password' + new URL(done.devResetLink).search : null;
    return (<AuthShell><div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50"><MailCheck className="h-8 w-8 text-emerald-600" /></span>
      <h1 className="mt-5 text-3xl font-bold">Check your email</h1><p className="mt-3 text-sm text-slate-500">If an account exists for <b className="text-navy-800">{email}</b>, we have sent a link to reset your password. It is valid for 1 hour.</p>
      {dev && <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-left"><p className="text-xs font-semibold text-amber-800">Development mode — no email server is configured</p><p className="mt-1 text-xs text-amber-700">Use this link instead of an email:</p><Link to={dev} className="btn-primary mt-3 w-full">Open reset link</Link></div>}
      <Link to="/login" className="btn-secondary mt-6 w-full"><ArrowLeft className="h-4 w-4" />Back to sign in</Link></div></AuthShell>);
  }
  return (
    <AuthShell><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-iris-50"><KeyRound className="h-6 w-6 text-iris-600" /></span>
      <h1 className="mt-5 text-3xl font-bold">Forgot your password?</h1><p className="mt-2 text-sm text-slate-500">Enter your account email and we will send you a link to choose a new one.</p>
      <form onSubmit={submit} className="mt-8 space-y-5"><div><label className="label" htmlFor="fp-email">Email address</label><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="fp-email" type="email" className="input pl-10" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email" /></div></div>
        {err && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4 !text-white" /> : 'Send reset link'}</button></form>
      <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-800"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
    </AuthShell>
  );
}
