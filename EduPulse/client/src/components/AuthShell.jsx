import { Link } from 'react-router-dom';
import { ArrowLeft, BellRing, ShieldCheck, LineChart, Lock, CalendarCheck, TrendingUp } from 'lucide-react';
import { Logo } from './Layout.jsx';

const Ring = ({ value }) => (
  <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke="#bfb1fb" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${value * 0.9425} 100`} /></svg>
);

export function AuthShell({ children, wide }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.02fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 animate-blob rounded-full bg-iris-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] animate-blob rounded-full bg-navy-400/30 blur-3xl [animation-delay:-6s]" />
        <Link to="/" className="relative w-fit"><Logo dark /></Link>
        <div className="relative">
          <div className="relative mx-auto mb-10 h-64 max-w-md">
            <div className="absolute left-0 top-4 w-56 animate-float rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3"><div className="relative"><Ring value={86} /><span className="absolute inset-0 flex items-center justify-center text-xs font-bold">86%</span></div><div><p className="text-xs text-navy-200">Attendance</p><p className="text-sm font-semibold">Above requirement</p></div></div>
            </div>
            <div className="absolute right-0 top-0 w-52 animate-float-slow rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md [animation-delay:-2s]">
              <p className="flex items-center gap-2 text-xs text-navy-200"><TrendingUp className="h-3.5 w-3.5 text-emerald-300" />Class average</p>
              <div className="mt-3 flex h-16 items-end gap-1.5">{[38, 52, 46, 64, 58, 76, 82].map((h, i) => <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-iris-500 to-iris-300" style={{ height: `${h}%` }} />)}</div>
            </div>
            <div className="absolute bottom-2 left-10 w-64 animate-float rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md [animation-delay:-4s]">
              <div className="flex items-start gap-3"><span className="rounded-lg bg-rose-500/20 p-2"><BellRing className="h-4 w-4 text-rose-300" /></span><div><p className="text-sm font-semibold">Early warning</p><p className="text-xs text-navy-200">Attendance dipped to 68% — action suggested</p></div></div>
            </div>
          </div>
          <h2 className="!text-4xl font-bold leading-tight !text-white">Every student, every signal — in one place.</h2>
          <p className="mt-4 max-w-md text-navy-200">Attendance, marks, fees and progress tracked in real time, with early warnings that reach teachers before a problem becomes a crisis.</p>
          <ul className="mt-6 grid max-w-md grid-cols-2 gap-3 text-xs text-navy-100">
            {[[ShieldCheck, 'Role-based access'], [Lock, 'Encrypted sessions'], [LineChart, 'Live analytics'], [CalendarCheck, 'Smart attendance']].map(([I, t]) => (<li key={t} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2"><I className="h-4 w-4 text-iris-300" />{t}</li>))}
          </ul>
        </div>
        <p className="relative text-xs text-navy-300">© {new Date().getFullYear()} EduPulse – Smart Student Monitoring System</p>
      </div>
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between"><div className="lg:hidden"><Link to="/"><Logo /></Link></div><Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy-800"><ArrowLeft className="h-4 w-4" />Back to home</Link></div>
        <div className="flex flex-1 items-center justify-center py-8"><div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'} animate-fade-up`}>{children}</div></div>
      </div>
    </div>
  );
}
