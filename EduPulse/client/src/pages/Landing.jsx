import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, TrendingUp, GraduationCap, Wallet, BellRing, BookOpenCheck, FileBarChart, Radio, ShieldCheck, Lock, KeyRound, UserCheck, ArrowRight, Check, Sparkles, ChevronDown, Users, Presentation } from 'lucide-react';
import { Logo } from '../components/Layout.jsx';
import { useReveal, useCountUp } from '../lib/fx.js';

const Reveal = ({ children, className = '', delay = 0 }) => { const ref = useReveal(); return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>; };
const Counter = ({ to, suffix = '', label }) => { const [n, ref] = useCountUp(to); return <div ref={ref} className="text-center"><p className="text-4xl font-extrabold text-white sm:text-5xl">{n}{suffix}</p><p className="mt-1 text-sm text-navy-200">{label}</p></div>; };

const FEATURES = [
  [CalendarCheck, 'Smart attendance', 'Daily, monthly and subject-wise tracking with one-tap class marking and instant shortage detection.', 'sky'],
  [ClipboardList, 'Live gradebook', 'Spreadsheet-style mark entry — type a score and every dashboard updates instantly.', 'iris'],
  [TrendingUp, 'Performance analytics', 'Trend lines, class comparisons, radar profiles and rankings that show where students stand.', 'emerald'],
  [BellRing, 'Early warnings', 'Six automatic rules flag attendance, marks, absences, declines, assignments and fees.', 'rose'],
  [GraduationCap, 'Results & CGPA', 'Semester grades, GPA and CGPA calculated automatically on the 10-point scale.', 'navy'],
  [Wallet, 'Fees & receipts', 'Track dues, partial payments, history and printable receipts with overdue alerts.', 'amber'],
  [BookOpenCheck, 'Missed courses', 'Absent? Students get the missed topics, notes, recordings and resources automatically.', 'iris'],
  [FileBarChart, 'Reports & exports', 'Report cards, class summaries and attendance-shortage lists — print, PDF or CSV.', 'sky'],
];
const TONE = { sky: 'bg-sky-50 text-sky-600', iris: 'bg-iris-100 text-iris-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600', navy: 'bg-navy-50 text-navy-700', amber: 'bg-amber-50 text-amber-600' };
const FAQ = [
  ['Who can see a student\'s records?', 'Students see only their own data, teachers see only the students assigned to them, and administrators manage the whole institution. This is enforced on the server for every request.'],
  ['How do the early warnings work?', 'The system re-checks each student whenever attendance, marks, assignments or fees change. Teachers get the severity, reason and a recommended action; students get improvement tips.'],
  ['Are updates really real-time?', 'Yes. When a teacher saves marks or attendance, every open dashboard, chart and notification refreshes within a moment — no page reload needed.'],
  ['What if I forget my password?', 'Use "Forgot password" on the sign-in page. You will receive a one-hour, single-use link, and all other devices are signed out when you set a new password.'],
];

function Preview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-iris-300/40 via-transparent to-navy-300/40 blur-2xl" />
      <div className="relative animate-float-slow rounded-3xl border border-slate-200/80 bg-white p-4 shadow-pop">
        <div className="mb-3 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /><span className="ml-3 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span></div>
        <div className="grid grid-cols-3 gap-3">{[['Attendance', '86%', 'text-sky-600'], ['Avg marks', '74%', 'text-iris-600'], ['CGPA', '8.4', 'text-navy-700']].map(([l, v, c]) => <div key={l} className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-slate-400">{l}</p><p className={`mt-1 text-xl font-extrabold ${c}`}>{v}</p></div>)}</div>
        <div className="mt-3 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-navy-800">Monthly attendance</p>
          <svg viewBox="0 0 300 90" className="mt-2 w-full"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7554dc" stopOpacity=".35" /><stop offset="1" stopColor="#7554dc" stopOpacity="0" /></linearGradient></defs>
            <path d="M0 62 C40 55 60 30 100 38 S170 60 205 30 S270 20 300 14 V90 H0Z" fill="url(#lg)" /><path d="M0 62 C40 55 60 30 100 38 S170 60 205 30 S270 20 300 14" fill="none" stroke="#7554dc" strokeWidth="3" strokeLinecap="round" /><line x1="0" y1="52" x2="300" y2="52" stroke="#f43f5e" strokeDasharray="4 4" strokeWidth="1" /></svg></div>
        <div className="mt-3 space-y-2">{[['critical', 'Continuous absence · 5 days', 'bg-rose-50 text-rose-700'], ['medium', 'Low marks in Computer Networks', 'bg-amber-50 text-amber-700']].map(([s, t, c]) => <div key={t} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${c}`}><span className="font-medium">{t}</span><span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase">{s}</span></div>)}</div>
      </div>
      <div className="absolute -left-6 bottom-10 hidden animate-float items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-pop sm:flex"><span className="rounded-xl bg-emerald-50 p-2"><Check className="h-4 w-4 text-emerald-600" /></span><div><p className="text-xs font-semibold text-navy-900">Marks saved</p><p className="text-[10px] text-slate-500">Student dashboards updated</p></div></div>
      <div className="absolute -right-4 -top-4 hidden animate-float items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-pop [animation-delay:-3s] sm:flex"><BellRing className="h-4 w-4 text-rose-500" /><p className="text-xs font-semibold text-navy-900">3 new alerts</p></div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8"><Link to="/"><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">{[['Features', '#features'], ['How it works', '#how'], ['Roles', '#roles'], ['Security', '#security'], ['FAQ', '#faq']].map(([l, h]) => <a key={l} href={h} className="transition hover:text-navy-800">{l}</a>)}</nav>
          <div className="ml-auto flex items-center gap-2"><Link to="/login" className="btn-ghost">Sign in</Link><Link to="/signup" className="btn-primary">Get started<ArrowRight className="h-4 w-4" /></Link></div></div>
      </header>

      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] animate-blob rounded-full bg-iris-300/30 blur-3xl" /><div className="pointer-events-none absolute -left-40 top-40 h-[26rem] w-[26rem] animate-blob rounded-full bg-navy-200/40 blur-3xl [animation-delay:-7s]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-iris-200 bg-iris-50 px-3.5 py-1.5 text-xs font-semibold text-iris-700"><Sparkles className="h-3.5 w-3.5" />Real-time student monitoring for colleges</span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] sm:text-6xl">Know every student's progress <span className="bg-gradient-to-r from-iris-600 to-navy-600 bg-clip-text text-transparent">before it becomes a problem.</span></h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">EduPulse brings attendance, marks, results, fees and wellbeing into one live dashboard — with automatic early warnings that tell teachers exactly who needs help, and why.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><Link to="/signup" className="btn-primary !px-6 !py-3.5 text-base">Create free account<ArrowRight className="h-4 w-4" /></Link><Link to="/login" className="btn-secondary !px-6 !py-3.5 text-base">Sign in</Link></div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">{['Admin, Teacher & Student portals', 'Instant live updates', 'Secure by design'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" />{t}</li>)}</ul>
          </div>
          <Preview />
        </div>
      </section>

      <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 py-14"><div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 md:grid-cols-4">
        <Counter to={6} label="Automatic early-warning rules" /><Counter to={3} label="Role-based portals" /><Counter to={10} label="Integrated modules" /><Counter to={100} suffix="%" label="Server-side access control" /></div></section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><Reveal className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-iris-600">Everything in one place</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Built for how colleges actually work</h2><p className="mt-4 text-slate-600">From daily attendance to semester results, every record connects — so insights appear on their own.</p></Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(([I, t, d, tone], i) => (<Reveal key={t} delay={(i % 4) * 80}><div className="group h-full rounded-3xl border border-slate-200/70 bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1.5 hover:border-iris-200 hover:shadow-pop"><span className={`inline-flex rounded-2xl p-3 ${TONE[tone]}`}><I className="h-6 w-6" /></span><h3 className="mt-5 text-lg font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p></div></Reveal>))}</div></section>

      <section id="how" className="bg-slate-50 py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Reveal className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-iris-600">How it works</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">From data to action in three steps</h2></Reveal>
        <div className="relative mt-14 grid gap-8 md:grid-cols-3"><div className="absolute left-[16%] right-[16%] top-8 hidden border-t-2 border-dashed border-iris-200 md:block" />
          {[[ClipboardList, '1', 'Record', 'Teachers take attendance and enter marks in the live gradebook. Fees and assignments are tracked automatically.'], [Radio, '2', 'Detect', 'EduPulse re-checks every affected student instantly and raises alerts with severity, reason and a recommended action.'], [Users, '3', 'Act', 'Teachers remind students, parents are informed, and students get tips plus the notes and recordings they missed.']].map(([I, n, t, d], i) => (
            <Reveal key={t} delay={i * 120}><div className="relative text-center"><span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-pop ring-1 ring-iris-100"><I className="h-7 w-7 text-iris-600" /><span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">{n}</span></span><h3 className="mt-5 text-xl font-semibold">{t}</h3><p className="mx-auto mt-2 max-w-xs text-sm text-slate-600">{d}</p></div></Reveal>))}</div></div></section>

      <section id="roles" className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><Reveal className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-iris-600">One platform, three portals</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">The right view for everyone</h2></Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">{[[ShieldCheck, 'Administrators', 'Manage the whole institution', ['Users, teachers and subjects', 'Assign teachers to students', 'Fees, announcements and reports', 'Institution-wide analytics'], 'from-navy-800 to-navy-900 text-white'], [Presentation, 'Teachers', 'Focus on assigned students', ['Live gradebook and attendance', 'Early-warning inbox with actions', 'Report cards and class summaries', 'Feedback and announcements'], 'from-white to-white text-navy-900 border border-slate-200'], [GraduationCap, 'Students', 'See only their own journey', ['Attendance, marks and results', 'Fees, receipts and deadlines', 'Missed topics, notes and recordings', 'Personal tips to improve'], 'from-iris-600 to-iris-700 text-white']].map(([I, t, sub, items, cls], i) => (
          <Reveal key={t} delay={i * 100}><div className={`h-full rounded-3xl bg-gradient-to-br p-8 shadow-card ${cls}`}><I className="h-8 w-8 opacity-90" /><h3 className="mt-5 !text-inherit text-2xl font-bold">{t}</h3><p className="mt-1 text-sm opacity-80">{sub}</p><ul className="mt-6 space-y-3 text-sm">{items.map((x) => <li key={x} className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 opacity-80" />{x}</li>)}</ul></div></Reveal>))}</div></section>

      <section id="security" className="bg-navy-950 py-20 text-white"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Reveal className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-iris-300">Security first</p><h2 className="mt-3 !text-white text-3xl font-bold sm:text-4xl">Student data deserves real protection</h2></Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[[Lock, 'Encrypted passwords', 'bcrypt hashing — passwords are never stored in plain text.'], [UserCheck, 'Role-based access', 'Every request is scoped on the server to what you may see.'], [KeyRound, 'Safe recovery', 'Single-use, one-hour reset links; lockout after repeated failures.'], [ShieldCheck, 'Protected sessions', 'httpOnly cookies, CSRF checks and sign-out from all devices.']].map(([I, t, d], i) => (
          <Reveal key={t} delay={i * 80}><div className="h-full rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"><span className="inline-flex rounded-xl bg-iris-500/20 p-3"><I className="h-5 w-5 text-iris-300" /></span><h3 className="mt-4 font-semibold !text-white">{t}</h3><p className="mt-2 text-sm text-navy-200">{d}</p></div></Reveal>))}</div></div></section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-20 sm:px-8"><Reveal className="text-center"><p className="text-sm font-semibold uppercase tracking-widest text-iris-600">FAQ</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Questions, answered</h2></Reveal>
        <div className="mt-10 space-y-3">{FAQ.map(([q, a]) => (<Reveal key={q}><details className="group rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-card open:border-iris-200"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-900">{q}<ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary><p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p></details></Reveal>))}</div></section>

      <section className="px-5 pb-20 sm:px-8"><Reveal><div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy-900 via-navy-800 to-iris-700 px-8 py-16 text-center text-white shadow-pop"><div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <h2 className="relative !text-white text-3xl font-bold sm:text-4xl">Ready to see every student clearly?</h2><p className="relative mx-auto mt-4 max-w-xl text-navy-100">Create your account in under a minute, or explore with the demo logins.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3"><Link to="/signup" className="btn bg-white !px-7 !py-3.5 text-base text-navy-900 hover:bg-iris-50">Get started free</Link><Link to="/login" className="btn border border-white/30 !px-7 !py-3.5 text-base text-white hover:bg-white/10">Sign in</Link></div></div></Reveal></section>

      <footer className="border-t border-slate-200 bg-white py-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8"><Logo /><p className="text-xs text-slate-400">© {new Date().getFullYear()} EduPulse – Smart Student Monitoring System. All rights reserved.</p><div className="flex gap-5 text-sm text-slate-500"><Link to="/login" className="hover:text-navy-800">Sign in</Link><Link to="/signup" className="hover:text-navy-800">Sign up</Link><Link to="/forgot-password" className="hover:text-navy-800">Reset password</Link></div></div></footer>
    </div>
  );
}
