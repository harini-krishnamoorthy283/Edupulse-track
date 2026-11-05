import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Presentation, ShieldCheck, Mail, User, AtSign, Check, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { PasswordInput, StrengthMeter, scorePassword } from '../components/PasswordFields.jsx';
import { Spinner } from '../lib/ui.jsx';

const ROLES = [['student', 'Student', GraduationCap, 'View my records'], ['teacher', 'Teacher', Presentation, 'Manage my class'], ['admin', 'Admin', ShieldCheck, 'Run the system']];
const DEPTS = ['AI & Data Science', 'Computer Science', 'Electronics & Communication', 'Mechanical Engineering', 'Civil Engineering'];
const Icon = ({ as: I, ...p }) => <I className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" {...p} />;

export default function Signup() {
  const { signup } = useAuth(); const nav = useNavigate();
  const [role, setRole] = useState('student');
  const [f, setF] = useState({ name: '', email: '', username: '', password: '', confirm: '', rollNo: '', department: DEPTS[0], year: 1, semester: 1, designation: '', adminCode: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const match = f.confirm && f.password === f.confirm;
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!scorePassword(f.password).valid) return setErr('Password needs 8+ characters with a letter and a number');
    if (f.password !== f.confirm) return setErr('Passwords do not match');
    const body = { role, name: f.name, email: f.email, username: f.username, password: f.password };
    if (role === 'student') Object.assign(body, { rollNo: f.rollNo, department: f.department, year: Number(f.year), semester: Number(f.semester) });
    if (role === 'teacher') Object.assign(body, { department: f.department, designation: f.designation || undefined });
    if (role === 'admin') body.adminCode = f.adminCode;
    setBusy(true); try { await signup(body); nav('/dashboard'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <AuthShell wide>
      <h1 className="text-3xl font-bold">Create your account</h1><p className="mt-2 text-sm text-slate-500">Choose your role and set your own credentials.</p>
      <div className="mt-6 grid grid-cols-3 gap-3">{ROLES.map(([v, l, I, d]) => (
        <button key={v} type="button" onClick={() => setRole(v)} aria-pressed={role === v} className={`rounded-2xl border p-3 text-left transition ${role === v ? 'border-iris-400 bg-iris-50 ring-4 ring-iris-100' : 'border-slate-200 hover:border-slate-300'}`}>
          <I className={`h-5 w-5 ${role === v ? 'text-iris-600' : 'text-slate-400'}`} /><p className="mt-2 text-sm font-semibold text-navy-900">{l}</p><p className="hidden text-[11px] text-slate-500 sm:block">{d}</p></button>))}</div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="relative"><label className="label" htmlFor="su-name">Full name</label><div className="relative"><Icon as={User} /><input id="su-name" className="input pl-10" required value={f.name} onChange={set('name')} autoComplete="name" /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="su-email">Email</label><div className="relative"><Icon as={Mail} /><input id="su-email" type="email" className="input pl-10" required value={f.email} onChange={set('email')} autoComplete="email" /></div></div>
          <div><label className="label" htmlFor="su-user">Username</label><div className="relative"><Icon as={AtSign} /><input id="su-user" className="input pl-10" required value={f.username} onChange={set('username')} placeholder="letters, numbers, _ ." autoComplete="username" /></div></div></div>
        {role !== 'admin' && <div><label className="label" htmlFor="su-dept">Department</label><input id="su-dept" className="input" list="depts" required value={f.department} onChange={set('department')} /><datalist id="depts">{DEPTS.map((d) => <option key={d} value={d} />)}</datalist></div>}
        {role === 'student' && <div className="grid gap-4 sm:grid-cols-3"><div><label className="label" htmlFor="su-roll">Roll number</label><input id="su-roll" className="input" required value={f.rollNo} onChange={set('rollNo')} /></div>
          <div><label className="label" htmlFor="su-year">Year</label><select id="su-year" className="input" value={f.year} onChange={set('year')}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></div>
          <div><label className="label" htmlFor="su-sem">Semester</label><select id="su-sem" className="input" value={f.semester} onChange={set('semester')}>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</select></div></div>}
        {role === 'teacher' && <div><label className="label" htmlFor="su-des">Designation (optional)</label><input id="su-des" className="input" value={f.designation} onChange={set('designation')} placeholder="Assistant Professor" /></div>}
        {role === 'admin' && <div><label className="label" htmlFor="su-code">Admin access code</label><input id="su-code" className="input" type="password" required value={f.adminCode} onChange={set('adminCode')} /><p className="mt-1 text-[11px] text-slate-400">Given by your institution (the server's ADMIN_SIGNUP_CODE).</p></div>}
        <div><PasswordInput id="su-pw" label="Password" value={f.password} onChange={set('password')} autoComplete="new-password" minLength={8} /><StrengthMeter password={f.password} /></div>
        <div><PasswordInput id="su-cf" label="Confirm password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
          {f.confirm && <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${match ? 'text-emerald-600' : 'text-rose-600'}`}>{match ? <><Check className="h-3.5 w-3.5" />Passwords match</> : <><X className="h-3.5 w-3.5" />Passwords do not match</>}</p>}</div>
        {err && <p role="alert" className="animate-shake rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4 !text-white" /> : 'Create account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-iris-600 hover:underline">Sign in</Link></p>
    </AuthShell>
  );
}
